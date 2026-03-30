#!/usr/bin/env bun
// worker.mjs — SQLite Polling Worker (Claim-Confirm queue pattern)
// Polls raw_events, processes batches via Claude Code subprocess (Agent SDK),
// extracts conventions and writes .claude/rules/local/*.md files.
// Uses bun:sqlite — zero native dependencies.

import { Database } from 'bun:sqlite';
import { existsSync, writeFileSync, unlinkSync, appendFileSync, mkdirSync, readdirSync, readFileSync } from 'fs';
import { resolve, relative } from 'path';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { takeContentSnapshot, hasContentChanged, runQualityGate } from './quality-gate.mjs';
import { loadExistingSkills } from './skill-prompt-builder.mjs';

// Prevent "cannot be launched inside another Claude Code session" error
delete process.env.CLAUDECODE;

const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const dbDir = resolve(projectRoot, '.claude-auto-context', 'db');
const dbPath = resolve(dbDir, 'claude-auto-context.db');
const lockPath = resolve(projectRoot, '.claude-auto-context', 'worker.lock');
const logPath = resolve(dbDir, 'worker.log');

const STALE_THRESHOLD_S = 200;       // 200s → self-heal (just above AGENT_TIMEOUT_MS/1000)
const MAX_RETRIES = 3;
const AGENT_TIMEOUT_MS = 3 * 60_000; // 3min per agent session

// --- Logging ---
// NOTE: SIGKILL cannot be caught, so the lock file may be left behind on hard kills.
// The launcher script handles stale locks via `kill -0` check on next invocation.
// See also: scripts/worker-launcher.sh for the two-layer CLAUDECODE env var cleanup.

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  try { appendFileSync(logPath, line); } catch {}
}

// --- Queue Operations ---

function selfHeal(db, forceAll = false) {
  // Recover stale processing events
  // forceAll=true: recover ALL processing events (used on startup)
  // forceAll=false: recover only events older than STALE_THRESHOLD_S (used during polling)
  const healed = forceAll
    ? db.run(`
        UPDATE raw_events
        SET status = 'pending', claimed_at = NULL, retry_count = retry_count + 1
        WHERE status = 'processing'
      `)
    : db.run(`
        UPDATE raw_events
        SET status = 'pending', claimed_at = NULL, retry_count = retry_count + 1
        WHERE status = 'processing'
          AND claimed_at < datetime('now', '-${STALE_THRESHOLD_S} seconds')
      `);

  // Move over-retried events to dead
  const dead = db.run(`
    UPDATE raw_events
    SET status = 'dead'
    WHERE retry_count > ${MAX_RETRIES} AND status = 'pending'
  `);

  if (healed.changes > 0) log(`self-heal: ${healed.changes} events recovered`);
  if (dead.changes > 0) log(`self-heal: ${dead.changes} events moved to dead`);
}

function claimBatch(db) {
  return db.transaction(() => {
    selfHeal(db);
    const result = db.run(`
      UPDATE raw_events SET status='processing', claimed_at=datetime('now')
      WHERE status='pending'
    `);
    if (result.changes === 0) return [];
    return db.prepare(
      `SELECT * FROM raw_events WHERE status='processing' ORDER BY id ASC`
    ).all();
  })();
}

function confirmBatch(db, ids) {
  const stmt = db.prepare(`UPDATE raw_events SET status='done' WHERE id=?`);
  db.transaction(() => { for (const id of ids) stmt.run(id); })();
}

function rejectBatch(db, ids) {
  const stmt = db.prepare(`
    UPDATE raw_events SET status='pending', claimed_at=NULL, retry_count=retry_count+1
    WHERE id=?
  `);
  db.transaction(() => { for (const id of ids) stmt.run(id); })();
}

// --- Bulk Prompt Builder ---

// Extract metadata-only summary for low-value tool events to reduce token cost.
// Returns null to skip the event entirely.
function compressPayload(toolName, payload) {
  try {
    const d = JSON.parse(payload);
    const input = d.tool_input || {};
    switch (toolName) {
      case 'Read':
        return input.file_path || '(unknown file)';
      case 'Bash':
        return input.command || '(unknown command)';
      case 'Grep':
        return `grep ${JSON.stringify(input.pattern || '')} ${input.path || '.'}`;
      case 'Glob':
        return `glob ${input.pattern || ''}`;
      case 'WebFetch':
        return input.url || '(unknown url)';
      case 'Agent':
      case 'Task':
      case 'TaskCreate':
      case 'TaskUpdate':
      case 'TaskGet':
      case 'AskUserQuestion':
      case 'WebSearch':
        return null; // skip entirely
      default:
        return undefined; // use original payload
    }
  } catch {
    return undefined; // parse failed, use original payload
  }
}

const SKIP_TOOL_EVENTS = new Set(['Stop']);

function buildBulkPrompt(events) {
  const MAX_TOTAL = 100_000;
  const MAX_PAYLOAD = 2_000;
  const bySession = new Map();
  for (const e of events) {
    if (!bySession.has(e.session_id)) bySession.set(e.session_id, []);
    bySession.get(e.session_id).push(e);
  }
  let out = `# Observed Data: ${events.length} events, ${bySession.size} sessions\n`;
  let total = out.length;

  for (const [sid, evts] of bySession) {
    out += `\n## Session: ${sid}\n`;

    // Separate events by type: UserPromptSubmit first, then the rest
    const userPrompts = evts.filter(e => e.hook_type === 'UserPromptSubmit');
    const toolActivity = evts.filter(e =>
      e.hook_type !== 'UserPromptSubmit'
      && !SKIP_TOOL_EVENTS.has(e.hook_type)
    );

    // User Prompts section — placed first so LLM reads user intent before tool outputs
    if (userPrompts.length > 0) {
      out += `### User Prompts\n`;
      for (const e of userPrompts) {
        let p = e.payload.length > MAX_PAYLOAD
          ? e.payload.slice(0, MAX_PAYLOAD) + '...[truncated]' : e.payload;
        const line = `- [UserPromptSubmit] ${p}\n`;
        if (total + line.length > MAX_TOTAL) {
          out += '\n[...truncated due to size limit]\n';
          return out;
        }
        out += line;
        total += line.length;
      }
    }

    // Tool Activity section
    if (toolActivity.length > 0) {
      out += `### Tool Activity\n`;
      for (const e of toolActivity) {
        const compressed = compressPayload(e.tool_name, e.payload);
        if (compressed === null) continue; // skip this event

        let p;
        if (compressed !== undefined) {
          p = compressed; // use compressed metadata
        } else {
          // full payload for Write, Edit, and unknown tools
          p = e.payload.length > MAX_PAYLOAD
            ? e.payload.slice(0, MAX_PAYLOAD) + '...[truncated]' : e.payload;
        }

        const line = `- [${e.hook_type}${e.tool_name ? ':' + e.tool_name : ''}] ${p}\n`;
        if (total + line.length > MAX_TOTAL) {
          out += '\n[...truncated due to size limit]\n';
          return out;
        }
        out += line;
        total += line.length;
      }
    }
  }
  return out;
}

// --- Rules Topic Index Builder ---

function buildRulesTopicIndex(root) {
  const rulesDir = resolve(root, '.claude', 'rules');
  if (!existsSync(rulesDir)) return '';

  // Recursively collect all .md files under .claude/rules/
  const allFiles = [];
  function walkDir(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.name.endsWith('.md')) {
        allFiles.push(fullPath);
      }
    }
  }
  walkDir(rulesDir);

  if (allFiles.length === 0) return '';

  const withDesc = [];
  const withoutDescLocal = [];
  const withoutDescCommitted = [];

  for (const filePath of allFiles.sort()) {
    const content = readFileSync(filePath, 'utf8');
    const descMatch = content.match(/^description:\s*"?(.+?)"?\s*$/m);
    const relPath = relative(resolve(root, '.claude', 'rules'), filePath);
    const isLocal = relPath.startsWith('local/') || relPath.startsWith('local\\');

    if (descMatch) {
      withDesc.push({ relPath, description: descMatch[1] });
    } else if (isLocal) {
      withoutDescLocal.push({ relPath });
    } else {
      withoutDescCommitted.push({ relPath });
    }
  }

  let out = `\n# Existing Rules (${allFiles.length} files) — DO NOT create a rule if the same topic already exists\n`;

  if (withDesc.length > 0) {
    out += `\n## With description:\n`;
    for (const f of withDesc) {
      out += `- ${f.relPath}: ${f.description}\n`;
    }
  }

  if (withoutDescLocal.length > 0) {
    out += `\n## Without description — local (Read and add description: to frontmatter):\n`;
    for (const f of withoutDescLocal) {
      out += `- ${f.relPath}\n`;
    }
  }

  if (withoutDescCommitted.length > 0) {
    out += `\n## Without description — committed (Read to understand content, do NOT modify):\n`;
    for (const f of withoutDescCommitted) {
      out += `- ${f.relPath}\n`;
    }
  }

  return out;
}

// --- Existing Context Summary (ORCH-02) ---

function buildExistingContextSummary(root) {
  let summary = `\n# Existing Project Context — Check before creating anything new\n`;
  summary += `Before creating any new artifact, check this list. If a similar one exists, SKIP or UPDATE it instead of duplicating.\n`;

  // 1. Existing rules
  const rulesDir = resolve(root, '.claude', 'rules');
  const localRulesDir = resolve(root, '.claude', 'rules', 'local');
  const ruleFiles = [];
  if (existsSync(rulesDir)) {
    for (const f of readdirSync(rulesDir).filter(f => f.endsWith('.md'))) {
      ruleFiles.push(`committed/${f}`);
    }
  }
  if (existsSync(localRulesDir)) {
    for (const f of readdirSync(localRulesDir).filter(f => f.endsWith('.md'))) {
      ruleFiles.push(`local/${f}`);
    }
  }
  summary += `\n## Rules (${ruleFiles.length} files)\n`;
  for (const r of ruleFiles) summary += `- ${r}\n`;

  // 2. Existing skills
  const skills = loadExistingSkills(root);
  summary += `\n## Skills (${skills.length} dirs)\n`;
  for (const s of skills) summary += `- ${s.file}: ${s.description || s.name}\n`;

  // 3. Existing suggestions
  const suggestionsDir = resolve(root, '.claude-auto-context', 'suggestions');
  const suggestionFiles = [];
  if (existsSync(suggestionsDir)) {
    for (const f of readdirSync(suggestionsDir).filter(f => f.endsWith('.md'))) {
      suggestionFiles.push(f);
    }
  }
  summary += `\n## Open Suggestions (${suggestionFiles.length} files)\n`;
  for (const s of suggestionFiles) summary += `- ${s}\n`;

  // 4. Existing hooks
  const hooksDir = resolve(root, '.claude', 'hooks');
  const hookFiles = [];
  if (existsSync(hooksDir)) {
    for (const f of readdirSync(hooksDir)) {
      hookFiles.push(f);
    }
  }
  summary += `\n## Hooks (${hookFiles.length} files)\n`;
  for (const h of hookFiles) summary += `- ${h}\n`;

  return summary;
}

// --- Hygiene Prompt Builder ---

function buildHygienePrompt(root) {
  const rulesDir = resolve(root, '.claude', 'rules');
  const localRulesDir = resolve(root, '.claude', 'rules', 'local');
  const claudeMdPath = resolve(root, 'CLAUDE.md');
  const suggestionsDir = resolve(root, '.claude-auto-context', 'suggestions');

  let committedRulesContent = '';
  if (existsSync(rulesDir)) {
    for (const entry of readdirSync(rulesDir).sort()) {
      if (!entry.endsWith('.md')) continue;
      const content = readFileSync(resolve(rulesDir, entry), 'utf8');
      committedRulesContent += `\n### ${entry}\n\`\`\`\n${content}\n\`\`\`\n`;
    }
  }

  let localRulesContent = '';
  if (existsSync(localRulesDir)) {
    for (const entry of readdirSync(localRulesDir).sort()) {
      if (!entry.endsWith('.md')) continue;
      const content = readFileSync(resolve(localRulesDir, entry), 'utf8');
      localRulesContent += `\n### ${entry}\n\`\`\`\n${content}\n\`\`\`\n`;
    }
  }

  let claudeMd = '';
  if (existsSync(claudeMdPath)) {
    claudeMd = readFileSync(claudeMdPath, 'utf8');
  }

  return `# Context Hygiene Check

## Scope Restriction

**CRITICAL**: You may only CREATE or MODIFY files in \`.claude/rules/local/\`.
- \`.claude/rules/*.md\` (committed team rules): READ-ONLY — analyze but never modify
- \`CLAUDE.md\`: READ-ONLY — analyze but never modify
- \`.claude/rules/local/*.md\` (auto-generated rules): full read/write access
- Suggestion files in \`.claude-auto-context/suggestions/\`: create only

You are a context hygiene auditor. Your job is to analyze the project's
context files (committed rules, local rules, and CLAUDE.md) for quality issues.

## Input: Current Context Files

### .claude/rules/ files (committed, READ-ONLY):
${committedRulesContent || '(none)'}

### .claude/rules/local/ files (auto-generated):
${localRulesContent || '(none)'}

### CLAUDE.md (READ-ONLY):
\`\`\`
${claudeMd || '(empty)'}
\`\`\`

## Your 5-Point Checklist

When you find an issue, create a suggestion file at:
\`.claude-auto-context/suggestions/hygiene-YYYYMMDD-HHMMSS-{slug}.md\`

Use current UTC time for the timestamp (e.g. hygiene-20260323-143052-stale-glob.md).
**IMPORTANT**: Always use the \`hygiene-\` prefix. Do NOT infer a naming pattern from existing files in the directory.

### H-01: Duplicate Detection
Compare all rules file pairs (committed + local). Flag two rules that prescribe
the same behavior for overlapping globs. "Same behavior" means Claude would
take the same action on the same file.
- Output category: \`hygiene-duplicate\`

### H-02: Contradiction Detection
Compare all rules file pairs (committed + local) AND rules vs CLAUDE.md.
Flag two directives that give opposite instructions for the same scope.
Example: Rule A says "use try-catch" for src/**/*.ts,
Rule B says "use Result type, no try-catch" for src/**/*.ts.
- Output category: \`hygiene-contradiction\`

### H-03: Stale Reference Detection
For each rules file with globs patterns in frontmatter,
use the Glob tool to verify matching files exist in the codebase.
If a glob matches 0 files, that rule is stale.
- Output category: \`hygiene-stale\`

### H-04: Verbosity / Token Efficiency
Measure character count of each rules file. If over 500 chars AND
the same meaning can be expressed in 50% fewer chars,
suggest a compressed version.
- Output category: \`hygiene-verbose\`

### H-06: Priority Placement (Lost-in-Middle)
When 5+ rules files exist, check if critical rules (error handling,
security, testing) have narrow globs limiting their visibility.
Critical rules with narrow globs should be flagged.
- Output category: \`hygiene-ordering\`

## Output Format

Create one file per issue:
\`.claude-auto-context/suggestions/hygiene-YYYYMMDD-HHMMSS-{slug}.md\`

Use exactly this format:

\`\`\`markdown
# Suggestion: {descriptive title}

## Status
pending

## Created
{ISO 8601 UTC timestamp}

## Category
{hygiene-duplicate | hygiene-contradiction | hygiene-stale |
 hygiene-verbose | hygiene-ordering}

## Problem
{description with specific file names and content excerpts}

## Proposal
{concrete fix: merge these files / remove this rule /
 rewrite as follows / move this section to a rules file}

## Evidence
- Source: hygiene-agent automated check
- Files analyzed: {list}
- Check: {H-01 | H-02 | ... | H-06}

## Metrics
- {relevant metric: duplication %, char reduction %, etc}
\`\`\`

## Rules

- Only report real issues. If all 5 checks pass, create no files.
- Do NOT modify committed rules files or CLAUDE.md.
- Read existing suggestions first to avoid duplicating pending suggestions.
- One suggestion file per issue. Do not combine multiple issues.`;
}

// --- Process Batch via Claude Agent SDK ---

async function processBatch(events, db) {
  const bulkPrompt = buildBulkPrompt(events);
  const rulesTopicIndex = buildRulesTopicIndex(projectRoot);
  const existingContextSummary = buildExistingContextSummary(projectRoot);

  // ① Snapshot context files (full content) before orchestrator
  const snapshotBefore = takeContentSnapshot(projectRoot);

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), AGENT_TIMEOUT_MS);

  try {
    const result = query({
      prompt: `${bulkPrompt}
You are an orchestrator. Analyze the above session data and delegate to ALL FIVE agents below.
You MUST call each agent exactly once. Do NOT skip any agent. Do NOT do the work yourself.

1. rules-agent — Repeated conventions
   **Focus on "User Prompts" sections** — user corrections/prohibitions reveal conventions not in code.
   Note: rules-agent now writes to .claude/rules/local/. Rules without globs: frontmatter apply project-wide.
2. suggestion-agent — AI-unfriendly code patterns and structural issues
   Focus on "Tool Activity" sections for repeated file reads, large files, unclear naming, missing CLAUDE.md entries.
3. hooks-agent — Detect repetitive manual actions and generate hook configurations
   **Focus on "Tool Activity" sections** — repeated tool patterns (lint, format, test) and dangerous commands.
4. skill-agent — Detect repeated multi-step workflows and create SKILL.md files
   Analyzes raw session events for automation-worthy patterns. Writes to both .claude/skills/ and skills/.
5. hygiene-agent — Context quality audit
   Checks rules, hooks, and suggestions for duplicates, contradictions, and stale references.

Call all five agents now.`,
      options: {
        model: 'sonnet',
        cwd: projectRoot,
        allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Task'],
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        abortController: ac,
        maxTurns: 25,
        maxBudgetUsd: 2.00,
        persistSession: false,
        settingSources: ['project'],
        stderr: (data) => log(`[stderr] ${data}`),
        agents: {
          "rules-agent": {
            description: "Extract conventions and implicit knowledge from session data into .claude/rules/ files. Analyzes session patterns to judge which conventions warrant rules.",
            prompt: `${existingContextSummary}

## Conservative Behavior (ORCH-03)
Before creating any new rule, suggestion, hook, or skill, check the context summary above.
If a similar artifact already exists, SKIP creation or UPDATE the existing one instead of duplicating.
Log "skipped — already exists: {name}" when you skip.

Follow the extract-rules skill instructions precisely. Analyze the session data provided by the orchestrator and create/update glob-scoped rules files.
${rulesTopicIndex}

## Description maintenance
Rules listed under "Without description — local" are missing a description: field in their YAML frontmatter.
Before creating new rules, Read each of these files, then add a one-line description: to their frontmatter.
Rules listed under "Without description — committed" are human-authored. Read them to understand their content and avoid duplicates, but do NOT modify them.`,
            tools: ['Read', 'Write', 'Edit', 'Glob'],
            skills: ['extract-rules'],
            maxTurns: 20,
          },
          "suggestion-agent": {
            description: "Detect AI-unfriendly code patterns and structural issues from session data. Creates proposal files in .claude-auto-context/suggestions/ with related file lists and quantitative evidence.",
            prompt: `${existingContextSummary}

## Conservative Behavior (ORCH-03)
Before creating any new rule, suggestion, hook, or skill, check the context summary above.
If a similar artifact already exists, SKIP creation or UPDATE the existing one instead of duplicating.
Log "skipped — already exists: {name}" when you skip.

You are a codebase optimization agent. Analyze the session data provided by the orchestrator to detect AI-unfriendly code patterns.

## What to detect (SUGG-01, SUGG-02)

1. **Large files read repeatedly** — If the same file appears in 3+ Read events across sessions, it is too large or doing too much. Suggest splitting.
2. **Unclear naming causing confusion** — If session data shows the agent reading multiple files to find the right one (exploratory Read/Grep chains), naming or directory structure is unclear.
3. **Missing CLAUDE.md entries** — If session data shows the agent making mistakes that a CLAUDE.md entry would prevent, suggest adding one.
4. **Poor directory structure** — If session data shows deep Glob/Grep chains to locate files, suggest reorganization.
5. **Repeated error-fix cycles** — If the same file is edited and re-read multiple times in a session (Edit→Read→Edit pattern), the code structure may be fragile.

## Output format

Create suggestion files at: \`.claude-auto-context/suggestions/YYYYMMDD-HHMMSS-{slug}.md\`
Use current UTC time for the timestamp.

Each suggestion MUST include (SUGG-03):

\`\`\`markdown
# Suggestion: {descriptive title}

## Status
pending

## Created
{ISO 8601 UTC timestamp}

## Category
{ai-unfriendly-large-file | ai-unfriendly-naming | ai-unfriendly-missing-docs | ai-unfriendly-structure | ai-unfriendly-fragile}

## Problem
{description with specific file names from session data and quantitative evidence}

## Related Files
- {file1.ext} — {why this file is involved}
- {file2.ext} — {why this file is involved}

## Proposal
{concrete fix: split file X into A and B, rename directory Y, add CLAUDE.md entry for Z}

## Evidence
- Sessions: {list of session IDs where pattern appeared}
- Events: {count of relevant events}
- Pattern: {specific tool-use pattern observed}
\`\`\`

## Rules
- Reference specific file paths from the session events — never use generic placeholders
- Every suggestion MUST have a "Related Files" section listing all files that would need modification
- Check existing suggestions in the context summary above before creating duplicates
- Maximum 2 suggestions per batch to avoid noise
- Only create suggestions with strong quantitative evidence (3+ occurrences)`,
            tools: ['Read', 'Write', 'Glob'],
            skills: ['create-suggestion'],
            maxTurns: 20,
          },
          "hooks-agent": {
            description: "Analyze session patterns to detect repetitive manual actions and generate Claude Code hook configurations. Covers linting/formatting automation, dangerous command blocking, and test auto-execution.",
            prompt: `${existingContextSummary}

## Conservative Behavior (ORCH-03)
Before creating any new rule, suggestion, hook, or skill, check the context summary above.
If a similar artifact already exists, SKIP creation or UPDATE the existing one instead of duplicating.
Log "skipped — already exists: {name}" when you skip.

You analyze session data to detect patterns that should become automated hooks.

## What to detect

1. **Formatter/Linter patterns**: Same lint/format command run manually after edits (eslint, prettier, black, gofmt)
   -> Generate PostToolUse:Edit|Write hook to auto-run
2. **Dangerous commands**: rm -rf, git push --force, git reset --hard, DROP TABLE
   -> Generate PreToolUse:Bash hook with exit 2 to block
3. **Secret/credential writes**: .env, .pem, .key files being written
   -> Generate PreToolUse:Write|Edit hook with exit 2 to block
4. **Test-before-stop**: Test suite run at session end repeatedly
   -> Generate Stop hook to auto-run tests

## Judgment guidance
- Use the session data to judge whether a pattern is a genuine habit vs one-off noise
- Consider: frequency, consistency across sessions, user intent signals
- Dangerous commands (rm -rf, force push) and secret writes (.env, .pem) warrant immediate action regardless of frequency

## Output rules
- Write hook scripts to target project's .claude/hooks/ directory
- Update target project's .claude/settings.json (read -> parse -> merge -> write)
- NEVER modify the plugin's hooks/hooks.json
- All PostToolUse/Stop hooks must include CAC_HOOK_RUNNING re-entry guard
- Hook scripts must use static command strings only (no dynamic session data injection)
- Maximum 1 hook per batch to avoid hook accumulation`,
            tools: ['Read', 'Write', 'Edit', 'Glob'],
            maxTurns: 20,
          },
          "skill-agent": {
            description: "Detect repeated multi-step workflows from raw session events and create SKILL.md files. Runs every cycle. Writes to both .claude/skills/ and skills/ (dual-dir sync).",
            prompt: `${existingContextSummary}

## Conservative Behavior (ORCH-03)
Before creating any new rule, suggestion, hook, or skill, check the context summary above.
If a similar artifact already exists, SKIP creation or UPDATE the existing one instead of duplicating.
Log "skipped — already exists: {name}" when you skip.

You are a skill extraction agent. Analyze the raw session events provided by the orchestrator to detect repeated multi-step workflows that deserve to become reusable skills.

## What to detect (SKIL-02)

Look for REPEATED multi-step tool sequences across sessions:
- Same tool chain appearing 2+ times (e.g., Read→Grep→Edit→Read→Bash pattern)
- Complex workflows with 4+ steps that follow a consistent pattern
- Domain-specific procedures (test→fix→test, deploy→verify, migration→validate)

## Necessity Gate

Before creating ANY skill, ALL three criteria must be true:
1. **Externalized Knowledge** — Requires domain knowledge or multi-step coordination Claude cannot reliably do from first principles.
2. **Repeatable Pattern** — Executed multiple times with same structure, different inputs.
3. **Context Budget Justification** — Skill instructions provide value exceeding their token cost.

### REJECT These (native Claude capability)
- Read + find + fix (high Read/Grep ratio + 1-2 Edit)
- Single-file edits, naming/style fixes
- Debugging spirals, one-shot tasks, generic exploration

If a candidate fails: log "SKIP: {pattern} — {reason}" and create nothing.

## Output: SKILL.md Format (SKIL-03)

Create SKILL.md in BOTH locations (dual-dir sync):
- \`.claude/skills/{skill-name}/SKILL.md\`
- \`skills/{skill-name}/SKILL.md\`

Both copies MUST be identical.

Use this exact format:
\`\`\`markdown
---
name: {skill-name}
description: {one-line description}. USE WHEN {trigger phrase}.
---

# {Skill Title}

{What this skill does — 1-2 sentences.}

## Qualification Criteria

{When to use this skill — specific conditions}

## Procedure

1. {Step 1}
2. {Step 2}
...

## Anti-Patterns

- Do NOT {common misuse}
\`\`\`

## Deduplication (SKIL-04)

Check the "Skills" section in the context summary above. Do NOT create a skill that overlaps with any existing skill by name or workflow purpose.

## Rules
- Maximum 1 skill per batch. Pick the strongest candidate.
- If no candidate passes the Necessity Gate, create nothing. Most sessions will NOT yield a skill.
- Both SKILL.md copies must be identical (dual-dir sync).
- Use concrete tool names and file patterns from the session data, not generic placeholders.`,
            tools: ['Read', 'Write', 'Glob'],
            maxTurns: 20,
          },
          "hygiene-agent": {
            description: "Context quality auditor. Checks rules, hooks, and suggestions for duplicates, contradictions, stale references, verbosity, and priority placement issues.",
            prompt: `${existingContextSummary}

## Conservative Behavior (ORCH-03)
Before creating any new rule, suggestion, hook, or skill, check the context summary above.
If a similar artifact already exists, SKIP creation or UPDATE the existing one instead of duplicating.
Log "skipped — already exists: {name}" when you skip.

${buildHygienePrompt(projectRoot)}`,
            tools: ['Read', 'Write', 'Glob'],
            maxTurns: 15,
          },
        },
      }
    });

    for await (const message of result) {
      if (message.type === 'result') {
        const denials = message.permission_denials?.length ?? 0;
        log(`agent-batch session=${message.session_id ?? 'unknown'} turns=${message.num_turns ?? '?'} cost=$${message.total_cost_usd ?? '?'} denials=${denials} subtype=${message.subtype} result=${message.result?.slice(0, 500) ?? ''}`);
        if (denials > 0) {
          log(`agent-batch WARNING: ${denials} permission denial(s) detected — check settings.json permissions`);
        }
      }
    }
  } finally {
    clearTimeout(timer);
  }

  // ② Quality Gate — evaluate agent output, auto-fix or revert low-quality changes
  try {
    const gate = runQualityGate(snapshotBefore, projectRoot);
    if (gate.evaluated > 0) {
      log(`quality-gate: ${gate.evaluated} evaluated, ${gate.passed} passed, ${gate.failed} failed, ${gate.autoFixed} auto-fixed`);
      const stmt = db.prepare(`
        INSERT INTO quality_evaluations (file_path, file_type, change_type, verdict, checks_json, reverted)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      db.transaction(() => {
        for (const r of gate.results) {
          stmt.run(r.filePath, r.fileType, r.action, r.verdict,
            JSON.stringify(r.checks.map(c => ({ id: c.id, name: c.name, passed: c.passed, detail: c.detail }))),
            r.reverted ? 1 : 0);
        }
      })();
    }
  } catch (err) {
    log(`quality-gate: failed (non-fatal): ${err.message}`);
  }

}

// --- Lifecycle ---

function cleanup() {
  try { unlinkSync(lockPath); } catch {}
  log('worker stopped, lock removed');
}

// --- Main ---

async function main() {
  if (!existsSync(dbPath)) {
    console.error(`DB not found: ${dbPath}`);
    process.exit(1);
  }

  writeFileSync(lockPath, String(process.pid));
  log(`worker started (pid=${process.pid})`);

  process.on('SIGTERM', () => { cleanup(); process.exit(0); });
  process.on('SIGINT', () => { cleanup(); process.exit(0); });

  const db = new Database(dbPath);
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA busy_timeout = 5000');

  // Ensure output directories exist
  mkdirSync(resolve(projectRoot, '.claude', 'rules', 'local'), { recursive: true });
  mkdirSync(resolve(projectRoot, '.claude-auto-context', 'suggestions'), { recursive: true });

  // Ensure .claude/settings.json exists so sub-agents have Write permission for rules/suggestions
  const settingsPath = resolve(projectRoot, '.claude', 'settings.json');
  if (!existsSync(settingsPath)) {
    try {
      writeFileSync(settingsPath, JSON.stringify({
        permissions: {
          allow: [
            ".claude/rules/local/**",
            ".claude-auto-context/suggestions/**"
          ]
        }
      }, null, 2));
      log(`created ${settingsPath} with permissions.allow for rules and suggestions`);
    } catch (err) {
      log(`warning: failed to create settings.json: ${err.message}`);
    }
  }



  // Quality evaluations table
  db.run(`
    CREATE TABLE IF NOT EXISTS quality_evaluations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp   TEXT NOT NULL DEFAULT (datetime('now')),
      file_path   TEXT NOT NULL,
      file_type   TEXT NOT NULL,
      change_type TEXT NOT NULL,
      verdict     TEXT NOT NULL,
      checks_json TEXT NOT NULL,
      reverted    INTEGER DEFAULT 0
    )
  `);

  // Recover orphaned processing events from previous worker (crash/SIGKILL)
  selfHeal(db, true);
  log('startup: recovered any orphaned processing events');

  // Check pending event count — skip if below threshold
  const { cnt } = db.prepare(`SELECT COUNT(*) as cnt FROM raw_events WHERE status='pending'`).get();
  if (cnt < 100) {
    log(`threshold: ${cnt} pending events < 100, skipping batch`);
    db.close();
    cleanup();
    return;
  }
  log(`threshold: ${cnt} pending events >= 100, proceeding`);

  try {
    const batch = claimBatch(db);
    if (batch.length > 0) {
      log(`claimed ${batch.length} events`);
      try {
        await processBatch(batch, db);
        confirmBatch(db, batch.map(e => e.id));
        log(`confirmed ${batch.length} events`);
      } catch (err) {
        log(`processBatch failed: ${err.message}`);
        rejectBatch(db, batch.map(e => e.id));
      }
    } else {
      log('no pending events — exiting');
    }
  } finally {
    db.close();
    cleanup();
  }
}

main();
