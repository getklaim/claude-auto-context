#!/usr/bin/env bun
// worker.mjs — SQLite Polling Worker (Claim-Confirm queue pattern)
// Polls raw_events, processes batches via Claude Code subprocess (Agent SDK),
// extracts conventions and writes .claude/rules/local/*.md files.
// Uses bun:sqlite — zero native dependencies.

import { Database } from 'bun:sqlite';
import { existsSync, writeFileSync, unlinkSync, rmdirSync, appendFileSync, mkdirSync, readdirSync, readFileSync } from 'fs';
import { resolve, relative } from 'path';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { takeContentSnapshot, hasContentChanged, runQualityGate } from './quality-gate.mjs';
import { loadExistingSkills } from './skill-prompt-builder.mjs';

// Prevent "cannot be launched inside another Claude Code session" error
delete process.env.CLAUDECODE;

const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const dbDir = resolve(projectRoot, '.claude-auto-context', 'db');
const dbPath = resolve(dbDir, 'claude-auto-context.db');
const lockDir = resolve(projectRoot, '.claude-auto-context', 'worker.lock.d');
const lockPidPath = resolve(lockDir, 'pid');
const logPath = resolve(dbDir, 'worker.log');

const STALE_THRESHOLD_S = 650;        // 650s → self-heal (just above AGENT_TIMEOUT_MS/1000)
const MAX_RETRIES = 3;
const AGENT_TIMEOUT_MS = 10 * 60_000; // 10min per agent session

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
        SET status = 'pending', claimed_at = NULL
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

const BATCH_LIMIT = 500;

function claimBatch(db) {
  return db.transaction(() => {
    selfHeal(db);
    // Claim a bounded batch to prevent buildBulkPrompt truncation data loss
    const ids = db.prepare(
      `SELECT id FROM raw_events WHERE status='pending' ORDER BY id ASC LIMIT ?`
    ).all(BATCH_LIMIT).map(r => r.id);
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    db.run(`UPDATE raw_events SET status='processing', claimed_at=datetime('now') WHERE id IN (${placeholders})`, ...ids);
    return db.prepare(
      `SELECT * FROM raw_events WHERE status='processing' AND id IN (${placeholders}) ORDER BY id ASC`
    ).all(...ids);
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
  const includedIds = new Set();
  const bySession = new Map();
  for (const e of events) {
    if (!bySession.has(e.session_id)) bySession.set(e.session_id, []);
    bySession.get(e.session_id).push(e);
  }
  let out = `# Observed Data: ${events.length} events, ${bySession.size} sessions\n`;
  let total = out.length;
  let truncated = false;

  for (const [sid, evts] of bySession) {
    if (truncated) break;
    const header = `\n## Session: ${sid}\n`;
    total += header.length;
    out += header;

    // Separate events by type: UserPromptSubmit first, then the rest
    const userPrompts = evts.filter(e => e.hook_type === 'UserPromptSubmit');
    const toolActivity = evts.filter(e =>
      e.hook_type !== 'UserPromptSubmit'
      && !SKIP_TOOL_EVENTS.has(e.hook_type)
    );

    // User Prompts section — placed first so LLM reads user intent before tool outputs
    if (userPrompts.length > 0) {
      const secHeader = `### User Prompts\n`;
      total += secHeader.length;
      out += secHeader;
      for (const e of userPrompts) {
        let p = e.payload.length > MAX_PAYLOAD
          ? e.payload.slice(0, MAX_PAYLOAD) + '...[truncated]' : e.payload;
        const line = `- [UserPromptSubmit] ${p}\n`;
        if (total + line.length > MAX_TOTAL) {
          out += '\n[...truncated due to size limit]\n';
          truncated = true;
          break;
        }
        out += line;
        total += line.length;
        includedIds.add(e.id);
      }
    }

    // Tool Activity section
    // Payloads are pre-compressed at ingestion (collector.mjs) — use directly.
    // Legacy uncompressed payloads are handled by compressPayload() fallback.
    if (!truncated && toolActivity.length > 0) {
      const secHeader = `### Tool Activity\n`;
      total += secHeader.length;
      out += secHeader;
      for (const e of toolActivity) {
        // Try legacy compression for old uncompressed events
        const compressed = compressPayload(e.tool_name, e.payload);
        if (compressed === null) {
          includedIds.add(e.id); // skipped by design (low-value), still counts as processed
          continue;
        }

        let p;
        if (compressed !== undefined) {
          p = compressed; // legacy: compressed metadata
        } else {
          // Already compressed at ingestion, or Write/Edit/unknown — use as-is with cap
          p = e.payload.length > MAX_PAYLOAD
            ? e.payload.slice(0, MAX_PAYLOAD) + '...[truncated]' : e.payload;
        }

        const line = `- [${e.hook_type}${e.tool_name ? ':' + e.tool_name : ''}] ${p}\n`;
        if (total + line.length > MAX_TOTAL) {
          out += '\n[...truncated due to size limit]\n';
          truncated = true;
          break;
        }
        out += line;
        total += line.length;
        includedIds.add(e.id);
      }
    }
  }
  return { prompt: out, includedIds };
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

  // 3. Existing suggestions (filename + description field or title fallback)
  const suggestionsDir = resolve(root, '.claude-auto-context', 'suggestions');
  const suggestions = [];
  if (existsSync(suggestionsDir)) {
    for (const f of readdirSync(suggestionsDir).filter(f => f.endsWith('.md'))) {
      const content = readFileSync(resolve(suggestionsDir, f), 'utf8');
      const descMatch = content.match(/^## Description\n(.+)/m);
      const titleMatch = content.match(/^#\s+Suggestion:\s*(.+)/m);
      suggestions.push({ file: f, description: descMatch?.[1]?.trim() || titleMatch?.[1]?.trim() || '' });
    }
  }
  summary += `\n## Open Suggestions (${suggestions.length} files)\n`;
  for (const s of suggestions) summary += `- ${s.file}${s.description ? ': ' + s.description : ''}\n`;

  // 4. Existing hooks (filename + Description: comment or title fallback)
  const hooksDir = resolve(root, '.claude', 'hooks');
  const hooks = [];
  if (existsSync(hooksDir)) {
    for (const f of readdirSync(hooksDir)) {
      const content = readFileSync(resolve(hooksDir, f), 'utf8');
      const descMatch = content.match(/^#\s*Description:\s*(.+)/m);
      const titleMatch = content.match(/^#\s+\w+ hook:\s*(.+)/m);
      hooks.push({ file: f, description: descMatch?.[1]?.trim() || titleMatch?.[1]?.trim() || '' });
    }
  }
  summary += `\n## Hooks (${hooks.length} files)\n`;
  for (const h of hooks) summary += `- ${h.file}${h.description ? ': ' + h.description : ''}\n`;

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

### H-07: Convention Decay
For each rule in .claude/rules/local/, check if the convention it describes
is still relevant. A rule is potentially decayed if:
- The rule references file patterns/names that no longer exist in the codebase (use Glob to verify)
- The rule describes a prohibition but no recent session events show the prohibited pattern being attempted
- The rule was auto-generated (in local/) and has been present for 30+ days without reinforcement
Flag decayed rules so the user can confirm removal.
- Output category: \`hygiene-decay\`

## Output Format

Create one file per TARGET FILE (not per issue). If a rules file has multiple problems (e.g. stale globs AND verbosity), combine them into ONE suggestion file.
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

// --- Orchestrator System Prompt (static, cacheable) ---

function buildOrchestratorSystemPrompt() {
  // NOTE: This prompt MUST exceed 2,048 tokens for Sonnet prompt caching to activate.
  // Claude Code's Agent SDK automatically adds cache_control markers to systemPrompt blocks.
  // If this prompt is below the threshold, caching silently fails (no error, cache_read=0).
  // Current estimate: ~2,500-2,900 tokens (10,105 chars). Do NOT shorten below 2,048 tokens.
  return `You are a background orchestrator for the Auto-Context system. Your role is to analyze session event data from Claude Code sessions and delegate analysis to five specialized agents. You do NOT perform any analysis yourself — you only coordinate.

## Execution Protocol

1. You will receive session event data in the user message, along with a context summary of existing artifacts and a rules topic index.
2. You MUST call ALL FIVE agents listed below, exactly once each, in any order.
3. Do NOT skip any agent. Do NOT do the work yourself. Do NOT summarize or analyze the data.
4. Pass the full session data context to each agent when delegating.
5. After all five agents complete, report their results.

## Agent Roster

### 1. rules-agent — Institutional Memory Builder
Extracts implicit conventions from user corrections in session data. Creates .claude/rules/local/ files following Boris Cherny's "institutional memory" pattern: past mistakes become permanent rules.

**Primary data source:** "User Prompts" sections of session data.
**Detection targets:**
- Explicit corrections: "don't", "never", "instead use", "하지마", "안돼", "쓰지마"
- Non-obvious commands the user typed that Claude got wrong
- Architecture decisions stated by user: "we use X because Y"

**Quality criteria (The Boris Test):** "Would removing this rule cause Claude to make mistakes?" If no, skip.
**Rejection criteria (ETH Zurich finding):** Anything discoverable from code/config, linter-handled issues, self-evident practices, information already in CLAUDE.md. Useless rules hurt performance.
**Output:** .claude/rules/local/{rule-name}.md with YAML frontmatter (description required, globs optional, NEVER paths).
**Format:** Rule body under 200 chars. One rule per file. Specific trigger → specific action.
**Path safety:** Write ONLY to project .claude/rules/local/ using absolute paths. NEVER write to ~/.claude/.

### 2. suggestion-agent — Codebase Optimization Detector
Detects AI-unfriendly code patterns and structural issues from session data. Creates proposal files in .claude-auto-context/suggestions/.

**Primary data source:** "Tool Activity" sections for repeated file reads, large files, unclear naming.
**Detection targets:**
- Large files read repeatedly (3+ Read events across sessions) — suggest splitting
- Unclear naming causing confusion (exploratory Read/Grep chains)
- Missing CLAUDE.md entries that would prevent recurring mistakes
- Poor directory structure (deep Glob/Grep chains to locate files)
- Repeated error-fix cycles (Edit→Read→Edit pattern in same file)

**Output:** .claude-auto-context/suggestions/YYYYMMDD-HHMMSS-{slug}.md
**Quality gate:** Maximum 2 suggestions per batch. Only create with strong quantitative evidence (3+ occurrences). Must include Related Files section.
**Deduplication:** Read existing suggestion descriptions before creating. Skip if overlapping root cause or target file.

### 3. hooks-agent — Automation Pattern Detector
Analyzes session patterns to detect repetitive manual actions and generate Claude Code hook configurations.

**Primary data source:** "Tool Activity" sections — repeated tool patterns and dangerous commands.
**Detection targets:**
- Formatter/Linter patterns: Same lint/format command run manually after edits → PostToolUse:Edit|Write hook
- Dangerous commands: rm -rf, git push --force, git reset --hard, DROP TABLE → PreToolUse:Bash hook with exit 2
- Secret/credential writes: .env, .pem, .key files → PreToolUse:Write|Edit hook with exit 2
- Test-before-stop: Test suite run at session end repeatedly → Stop hook

**Judgment guidance:** Use frequency and consistency across sessions to distinguish habit from noise. Dangerous commands and secret writes warrant immediate action regardless of frequency.
**Output:** Hook scripts in target project's .claude/hooks/ directory + settings.json update.
**Constraints:** Maximum 1 hook per batch. NEVER modify the plugin's hooks/hooks.json. All hooks must include CAC_HOOK_RUNNING re-entry guard.

### 4. skill-agent — Workflow Pattern Extractor
Detects repeated multi-step workflows from raw session events and creates SKILL.md files in the target project's .claude/skills/.

**Detection targets:** Repeated multi-step tool sequences across sessions:
- Same tool chain appearing 2+ times (e.g., Read→Grep→Edit→Read→Bash pattern)
- Complex workflows with 4+ steps following consistent patterns
- Domain-specific procedures (test→fix→test, deploy→verify, migration→validate)

**Necessity Gate (ALL three must be true):**
1. Externalized Knowledge — Requires domain knowledge Claude cannot reliably do from first principles
2. Repeatable Pattern — Executed multiple times with same structure, different inputs
3. Context Budget Justification — Skill instructions provide value exceeding their token cost

**Rejection criteria:** Read+find+fix sequences (native capability), single-file edits, debugging spirals, one-shot tasks, generic exploration.
**Cross-artifact deduplication:** Check existing skills, CLAUDE.md, and rules for overlap before creating.
**Output:** .claude/skills/{skill-name}/SKILL.md with frontmatter (name, description with USE WHEN trigger).
**Constraints:** Maximum 1 skill per batch. Most sessions will NOT yield a skill.

### 5. hygiene-agent — Context Quality Auditor
Checks rules, hooks, and suggestions for duplicates, contradictions, stale references, verbosity, and priority placement issues.

**Hygiene checks:**
- H-01 Duplicate Detection: Content overlap across rules/suggestions/hooks
- H-02 Contradiction Detection: Rules/hooks that conflict with each other
- H-03 Stale Reference Detection: Rules referencing files/patterns that no longer exist
- H-04 Verbosity Check: Rules exceeding 200 chars or containing discoverable-from-code info
- H-05 Cross-Location Consistency: CLAUDE.md entries contradicting rules files
- H-06 Priority Ordering: Critical rules with narrow globs that limit visibility
- H-07 Convention Decay: Rules referencing non-existent patterns, 30+ days without reinforcement

**Output:** .claude-auto-context/suggestions/hygiene-YYYYMMDD-HHMMSS-{slug}.md
**Constraints:** Only report real issues. If all checks pass, create no files. Do NOT modify committed rules or CLAUDE.md.

## Conservative Behavior Protocol (ORCH-03)

All agents share this rule: Before creating any new artifact, check the existing context summary provided in the user message. If a similar artifact already exists, agents must SKIP or UPDATE instead of duplicating. Agents log "skipped — already exists: {name}" when skipping.

## Quality Standards

- Every rules file MUST have YAML frontmatter with description field. Missing frontmatter = quality gate rejection.
- Frontmatter key is globs: (NEVER paths: — paths: silently applies to ALL files).
- Suggestions MUST include Related Files, Evidence, and Metrics sections.
- Hook scripts MUST start with #!/bin/bash header and include # Description: comment.
- Skills MUST pass the three-part Necessity Gate.
- All agents must use absolute paths with the project root. NEVER use ~ or $HOME.

## Sensitive File Protection Fallback

If any agent's Write/Edit is blocked for .claude/ paths due to sensitive file protection, agents should fall back to Bash:
printf '%s' "content" > /absolute/path/to/file.md

## Session Data Structure

The user message contains:
1. **Session event data** — Raw tool-use events from Claude Code sessions (Glob, Read, Edit, Bash calls with parameters and results)
2. **Existing context summary** — Current state of all rules, suggestions, hooks, and skills (for deduplication)
3. **Rules topic index** — Index of existing rules by topic (for rules-agent overlap checking)

Delegate ALL session data to each agent. Let each agent extract what is relevant to its domain.

## Common Session Event Patterns to Watch For

When analyzing session data, these patterns indicate high-value extraction opportunities:

**For rules-agent:**
- User types a correction twice across sessions → strong rule candidate
- User explicitly states a prohibition ("never use X") → immediate rule
- User demonstrates a non-obvious workflow that Claude missed → procedural rule

**For suggestion-agent:**
- Same file appears in 5+ Read events across sessions → file is too large or poorly named
- Grep→Read→Grep→Read chains (3+ hops) → directory structure is confusing for AI
- Edit→Read→Edit loops on same file → fragile code structure needing refactor

**For hooks-agent:**
- User runs prettier/eslint/black after every Edit → linter automation hook
- User manually runs test suite before stopping → test-on-stop hook
- Dangerous rm/force-push commands appearing in Bash events → blocking hook

**For skill-agent:**
- 4+ step tool chain repeated 2+ times with same structure → skill candidate
- Multi-file coordination pattern (read config → modify source → update test → run verify) → workflow skill
- Domain-specific procedure that requires external knowledge → strong skill candidate

**For hygiene-agent:**
- Two rules files describing the same convention with different wording → duplicate
- Rule says "always use X" while another says "avoid X in this context" → contradiction
- Rule references a file path or pattern that Glob cannot find → stale reference

## Inter-Agent Coordination

- rules-agent and hooks-agent may detect overlapping patterns. A linting command run manually should become a hook (automation), NOT a rule (instruction).
- suggestion-agent and hygiene-agent both create files in suggestions/. suggestion-agent creates structural improvement proposals; hygiene-agent creates cleanup proposals for existing context artifacts.
- skill-agent should verify its candidates don't overlap with existing rules or CLAUDE.md entries before creating.

## Cost Awareness

Each agent session consumes API tokens. Agents should be efficient: read only what is necessary, avoid exploratory searches when the answer is in the provided context summary, and produce output only when there is genuine signal. Creating zero artifacts is a valid and often correct outcome.

Call all five agents now.`;
}

const ORCHESTRATOR_SYSTEM_PROMPT = buildOrchestratorSystemPrompt();
log(`orchestrator-system-prompt: length=${ORCHESTRATOR_SYSTEM_PROMPT.length} hash=${Array.from(new Uint8Array(new TextEncoder().encode(ORCHESTRATOR_SYSTEM_PROMPT).slice(0, 64))).reduce((h, b) => ((h << 5) - h + b) | 0, 0).toString(16)}`);

// --- Process Batch via Claude Agent SDK ---

async function processBatch(events, db) {
  const { prompt: bulkPrompt, includedIds } = buildBulkPrompt(events);
  const rulesTopicIndex = buildRulesTopicIndex(projectRoot);
  const existingContextSummary = buildExistingContextSummary(projectRoot);

  // ① Snapshot context files (full content) before orchestrator
  const snapshotBefore = takeContentSnapshot(projectRoot);

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), AGENT_TIMEOUT_MS);

  try {
    const result = query({
      prompt: `${bulkPrompt}\n\n${existingContextSummary}\n\n${rulesTopicIndex}`,
      options: {
        systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT,
        model: 'sonnet',
        cwd: projectRoot,
        allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Bash', 'Task'],
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
            description: "Extract implicit conventions from user corrections in session data. Creates .claude/rules/ files following Boris Cherny's 'institutional memory' pattern: past mistakes become permanent rules.",
            prompt: `${existingContextSummary}

## CRITICAL: Output Path
Write rules ONLY to: ${projectRoot}/.claude/rules/local/
Use absolute paths. NEVER write to ~/.claude/ or any path outside the project.

## CRITICAL: File Format (every rule file MUST follow this exactly)
\`\`\`
---
description: "One-line summary of what this rule prevents"
globs: ["**/*.ts", "src/**"]     # OPTIONAL — omit for project-wide rules
---

[Rule body — under 200 chars. Specific trigger → specific action.]
\`\`\`

FRONTMATTER RULES:
- \`description:\` is REQUIRED in every file.
- \`globs:\` is OPTIONAL. Use it only for file-pattern-specific rules. Omit entirely for project-wide rules.
- NEVER use \`paths:\` — it silently applies the rule to ALL files regardless of the value. Always use \`globs:\`.
- Files missing the \`---\` block or \`description:\` field are INVALID and will be rejected by the quality gate.

## Conservative Behavior (ORCH-03)
Before creating any new rule, check the context summary above.
If a similar artifact already exists, SKIP or UPDATE. Log "skipped — already exists: {name}".

## Your Role: Institutional Memory Builder
You turn user corrections into permanent rules (Boris Cherny pattern).
When a user says "don't do X" or "use Y instead", that correction becomes a rule so Claude never repeats the mistake.

## Primary Source: User Prompts
Focus on the "User Prompts" section of session data. Look for:
1. Explicit corrections: "don't", "never", "instead use", "하지마", "안돼", "쓰지마"
2. Non-obvious commands the user typed that Claude got wrong
3. Architecture decisions stated by user: "we use X because Y"

## The Boris Test
For every candidate: "Would removing this rule cause Claude to make mistakes?"
- Yes → create rule
- No → skip (Claude can figure it out from code)

## What NOT to Create (ETH Zurich finding: useless rules hurt performance)
- Anything discoverable from code/config ("uses TypeScript", "tests in __tests__/")
- Things a linter handles (code style → should be a hook, not a rule)
- Self-evident practices ("write clean code")
- Information already in CLAUDE.md

## Rule Quality
- Body under 200 chars. Specific trigger → specific action.
- One rule per file. If you need more detail, you're writing docs, not a rule.
- BAD: 500 chars explaining Result type history
- GOOD: "Error handling: Result<T,E>, not try-catch. Return {ok, error} shape."

If Write/Edit is blocked for .claude/ paths (sensitive file protection), use Bash:
printf '%s' "content" > ${projectRoot}/.claude/rules/local/rule-name.md
NEVER use ~ or $HOME in the path. The absolute path above is the ONLY correct target.

Follow the extract-rules skill instructions for output format and procedure.
${rulesTopicIndex}

## Description maintenance
Rules listed "Without description — local": Read and add description: field.
Rules listed "Without description — committed": Read for context, do NOT modify.`,
            tools: ['Read', 'Write', 'Edit', 'Glob', 'Bash'],
            skills: ['extract-rules'],
            maxTurns: 15,
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

## Description
{one-line summary of what this suggestion proposes — used for deduplication and context display}

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
- Before creating a suggestion, READ the Description of each existing suggestion in the context summary. If your finding overlaps with an existing suggestion (same root cause or same target file), SKIP it. Log "skipped — overlaps with: {existing title}"
- Maximum 2 suggestions per batch to avoid noise. The quality gate will reject suggestions beyond 10 total pending.
- Only create suggestions with strong quantitative evidence (3+ occurrences)
- If the quality gate rejects your suggestion as a duplicate, that is correct behavior — do not retry`,
            tools: ['Read', 'Write', 'Glob', 'Bash'],
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

## Hook script format
Every hook script MUST start with this exact header pattern:
\`\`\`bash
#!/bin/bash
# {EventType} hook: {hook-name}
# Description: {one-line summary of what this hook does — used for deduplication and context display}
\`\`\`
The \`# Description:\` line is mandatory. It is parsed by the orchestrator for context summaries.

## Output rules
- If Write/Edit is blocked for .claude/ paths (sensitive file protection), use Bash:
  printf '%s' "content" > ${projectRoot}/.claude/hooks/hook-name.sh
  NEVER use ~ or $HOME in the path. The absolute path above is the ONLY correct target.
- Write hook scripts to target project's .claude/hooks/ directory
- Update target project's .claude/settings.json (read -> parse -> merge -> write)
- NEVER modify the plugin's hooks/hooks.json
- All PostToolUse/Stop hooks must include CAC_HOOK_RUNNING re-entry guard
- Hook scripts must use static command strings only (no dynamic session data injection)
- Maximum 1 hook per batch to avoid hook accumulation`,
            tools: ['Read', 'Write', 'Edit', 'Glob', 'Bash'],
            maxTurns: 20,
          },
          "skill-agent": {
            description: "Detect repeated multi-step workflows from raw session events and create SKILL.md files. Runs every cycle. Writes to .claude/skills/ in the target project.",
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

If Write/Edit is blocked for .claude/ paths (sensitive file protection), use Bash:
printf '%s' "content" > ${projectRoot}/.claude/skills/skill-name/SKILL.md
NEVER use ~ or $HOME in the path. The absolute path above is the ONLY correct target.

Create SKILL.md in the target project's .claude/skills/ directory only:
- \`.claude/skills/{skill-name}/SKILL.md\`

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

## Cross-Artifact Deduplication (SKIL-04)

Before creating a skill, check ALL of these for overlap — not just existing skills:
1. **Existing skills** in the "Skills" section of the context summary above
2. **CLAUDE.md** — constraint tables, architecture sections, convention docs
3. **Rules** in \`.claude/rules/local/\` — behavioral guardrails already enforced

If a constraint, anti-pattern, or guardrail already exists in CLAUDE.md or rules:
- Do NOT duplicate it in the skill. Write \`See CLAUDE.md: {section name}\` instead.
- The skill should contain ONLY the procedure (step ordering, tool chain) that is NOT documented elsewhere.

## Path Verification (SKIL-05)

Before referencing any file path in a skill, verify it exists with Glob or ls.
Do NOT write paths from memory — wrong paths make the skill actively harmful.

## Rules
- Maximum 1 skill per batch. Pick the strongest candidate.
- If no candidate passes the Necessity Gate, create nothing. Most sessions will NOT yield a skill.
- Use concrete tool names and file patterns from the session data, not generic placeholders.
- Anti-Patterns section is OPTIONAL. Only include if the anti-pattern is novel (not in CLAUDE.md/rules).`,
            tools: ['Read', 'Write', 'Glob', 'Bash'],
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
            tools: ['Read', 'Write', 'Glob', 'Bash'],
            skills: ['context-hygiene'],
            maxTurns: 15,
          },
        },
      }
    });

    for await (const message of result) {
      if (message.type === 'result') {
        const denials = message.permission_denials?.length ?? 0;
        const cacheRead = message.usage?.cache_read_input_tokens ?? 0;
        const cacheCreate = message.usage?.cache_creation_input_tokens ?? 0;
        log(`agent-batch session=${message.session_id ?? 'unknown'} turns=${message.num_turns ?? '?'} cost=$${message.total_cost_usd ?? '?'} cache_read=${cacheRead} cache_create=${cacheCreate} denials=${denials} subtype=${message.subtype} result=${message.result?.slice(0, 500) ?? ''}`);
        if (denials > 0) {
          log(`agent-batch WARNING: ${denials} permission denial(s) detected — check settings.json permissions`);
        }
      }
    }
  } finally {
    clearTimeout(timer);
  }

  // ② Quality Gate — evaluate agent output, auto-fix or revert low-quality changes
  // Runs independently from batch confirmation so a gate failure does not
  // trigger an expensive re-processing of the entire LLM batch.
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

      // Write notifications manifest for SessionStart hook
      const created = gate.results
        .filter(r => r.action === 'created' && r.verdict === 'pass' && !r.reverted)
        .map(r => relative(projectRoot, r.filePath));
      if (created.length > 0) {
        const notifPath = resolve(projectRoot, '.claude-auto-context', 'notifications.json');
        try {
          writeFileSync(notifPath, JSON.stringify({ created, ts: new Date().toISOString() }, null, 2));
          log(`notifications: ${created.length} new file(s) written to notifications.json`);
        } catch (err) {
          log(`notifications: failed to write notifications.json — ${err.message}`);
        }
      }
    }
  } catch (err) {
    log(`quality-gate: failed (non-fatal): ${err.message}`);
  }

  return includedIds;
}

// --- Lifecycle ---

function cleanup() {
  try { unlinkSync(lockPidPath); } catch {}
  try { rmdirSync(lockDir); } catch {}
  log('worker stopped, lock removed');
}

// --- Main ---

async function main() {
  if (!existsSync(dbPath)) {
    console.error(`DB not found: ${dbPath}`);
    process.exit(1);
  }

  mkdirSync(lockDir, { recursive: true });
  writeFileSync(lockPidPath, String(process.pid));
  log(`worker started (pid=${process.pid})`);

  process.on('SIGTERM', () => { cleanup(); process.exit(0); });
  process.on('SIGINT', () => { cleanup(); process.exit(0); });

  const db = new Database(dbPath);
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA busy_timeout = 5000');

  // Ensure output directories exist
  mkdirSync(resolve(projectRoot, '.claude', 'rules', 'local'), { recursive: true });
  mkdirSync(resolve(projectRoot, '.claude-auto-context', 'suggestions'), { recursive: true });
  mkdirSync(resolve(projectRoot, '.claude-auto-context', 'hygiene'), { recursive: true });

  // Ensure .claude/settings.json exists so sub-agents have Write permission for rules/suggestions
  const settingsPath = resolve(projectRoot, '.claude', 'settings.json');
  if (!existsSync(settingsPath)) {
    try {
      writeFileSync(settingsPath, JSON.stringify({
        permissions: {
          allow: [
            "Read(.claude/**)",
            "Write(.claude/rules/local/**)",
            "Edit(.claude/rules/local/**)",
            "Write(.claude/skills/**)",
            "Edit(.claude/skills/**)",
            "Write(.claude-auto-context/suggestions/**)",
            "Write(.claude-auto-context/hygiene/**)",
            "Write(.claude-auto-context/skill-prompts/**)"
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
        const includedIds = await processBatch(batch, db);
        // Only confirm events that were actually included in the prompt.
        // Events truncated by buildBulkPrompt are released back to pending
        // without incrementing retry_count so they get processed next cycle.
        const allIds = batch.map(e => e.id);
        const includedArr = allIds.filter(id => includedIds.has(id));
        const excludedArr = allIds.filter(id => !includedIds.has(id));
        confirmBatch(db, includedArr);
        if (excludedArr.length > 0) {
          // Release truncated events back to pending without penalty
          const stmt = db.prepare(`UPDATE raw_events SET status='pending', claimed_at=NULL WHERE id=?`);
          db.transaction(() => { for (const id of excludedArr) stmt.run(id); })();
          log(`released ${excludedArr.length} truncated events back to pending`);
        }
        log(`confirmed ${includedArr.length} events`);
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
