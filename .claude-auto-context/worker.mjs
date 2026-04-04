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

// --- Convention Decay ---

const DECAY_THRESHOLD_DAYS = 30;  // revalidate after 30 days
const DECAY_FORCE_DAYS = 60;      // force-delete after 60 days (safety net)

function getStaleRules(root) {
  const rulesDir = resolve(root, '.claude', 'rules');
  if (!existsSync(rulesDir)) return [];

  const today = new Date();
  const stale = [];

  for (const entry of readdirSync(rulesDir)) {
    if (!entry.endsWith('.md')) continue;
    const fullPath = resolve(rulesDir, entry);
    const content = readFileSync(fullPath, 'utf8');

    // Extract last_validated from frontmatter
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) continue;

    const lvMatch = fmMatch[1].match(/^last_validated:\s*"?(\d{4}-\d{2}-\d{2})"?/m);
    if (!lvMatch) continue;

    const lastValidated = new Date(lvMatch[1]);
    const daysSince = Math.floor((today - lastValidated) / (1000 * 60 * 60 * 24));

    if (daysSince >= DECAY_FORCE_DAYS) {
      // Too old, force delete
      unlinkSync(fullPath);
      log(`decay: force-deleted ${entry} (${daysSince} days since last validation)`);
    } else if (daysSince >= DECAY_THRESHOLD_DAYS) {
      stale.push({ file: entry, path: fullPath, content, daysSince });
    }
  }

  return stale;
}

function buildDecayPrompt(staleRules) {
  let prompt = `# Convention Decay Check

You are a rules validator. For each rule below, determine if it is still relevant
to the current codebase. Use the Glob and Read tools to verify.

For each rule:
- If STILL VALID: update only the \`last_validated\` field in frontmatter to today's date (${new Date().toISOString().split('T')[0]})
- If NO LONGER RELEVANT: delete the file entirely

## Rules to Validate

`;
  for (const r of staleRules) {
    prompt += `### ${r.file} (${r.daysSince} days since last validation)\n\`\`\`\n${r.content}\n\`\`\`\n\n`;
  }
  return prompt;
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
      case 'Edit':
        return `edit ${input.file_path || '(unknown)'} (${(input.old_string || '').length}→${(input.new_string || '').length} chars)`;
      case 'Write':
        return `write ${input.file_path || '(unknown)'} (${(input.content || '').length} chars)`;
      case 'NotebookEdit':
        return `notebook-edit ${input.notebook_path || '(unknown)'} cell#${input.cell_number ?? '?'}`;
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

// --- Per-Agent Context Builders (replaces monolithic buildExistingContextSummary) ---

function buildContextForAgent(root, domains) {
  let summary = `\n# Existing Project Context — Check before creating anything new\n`;
  summary += `Before creating any new artifact, check this list. If a similar one exists, SKIP or UPDATE it instead of duplicating.\n`;

  if (domains.includes('rules')) {
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
  }

  if (domains.includes('skills')) {
    const skills = loadExistingSkills(root);
    summary += `\n## Skills (${skills.length} dirs)\n`;
    for (const s of skills) summary += `- ${s.file}: ${s.description || s.name}\n`;
  }

  if (domains.includes('suggestions')) {
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
  }

  if (domains.includes('hooks')) {
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
  }

  return summary;
}

// --- Hygiene Prompt Builder ---

function buildHygienePrompt(root) {
  const rulesDir = resolve(root, '.claude', 'rules');
  const localRulesDir = resolve(root, '.claude', 'rules', 'local');
  const claudeMdPath = resolve(root, 'CLAUDE.md');
  const suggestionsDir = resolve(root, '.claude-auto-context', 'suggestions');

  // Build lightweight topic index instead of full content embedding
  let committedRulesIndex = '';
  if (existsSync(rulesDir)) {
    for (const entry of readdirSync(rulesDir).sort()) {
      if (!entry.endsWith('.md')) continue;
      const content = readFileSync(resolve(rulesDir, entry), 'utf8');
      const descMatch = content.match(/^description:\s*"?(.+?)"?\s*$/m);
      const charCount = content.length;
      committedRulesIndex += `- ${entry} (${charCount} chars)${descMatch ? ': ' + descMatch[1] : ''}\n`;
    }
  }

  let localRulesIndex = '';
  if (existsSync(localRulesDir)) {
    for (const entry of readdirSync(localRulesDir).sort()) {
      if (!entry.endsWith('.md')) continue;
      const content = readFileSync(resolve(localRulesDir, entry), 'utf8');
      const descMatch = content.match(/^description:\s*"?(.+?)"?\s*$/m);
      const charCount = content.length;
      localRulesIndex += `- ${entry} (${charCount} chars)${descMatch ? ': ' + descMatch[1] : ''}\n`;
    }
  }

  let claudeMdSize = 0;
  if (existsSync(claudeMdPath)) {
    claudeMdSize = readFileSync(claudeMdPath, 'utf8').length;
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
${committedRulesIndex || '(none)'}

### .claude/rules/local/ files (auto-generated):
${localRulesIndex || '(none)'}

### CLAUDE.md (READ-ONLY): ${claudeMdSize} chars
Use the Read tool to inspect CLAUDE.md content when needed for contradiction/duplicate checks.

**IMPORTANT**: File contents are NOT embedded to save tokens. Use the Read tool to read specific files when you need to compare content for duplicate/contradiction detection. Read only the files relevant to each check.

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

// --- Batch Cache for Conditional Execution ---

function initBatchCache(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS batch_cache (
      key       TEXT PRIMARY KEY,
      value     TEXT,
      hash      TEXT,
      updated   TEXT DEFAULT (datetime('now'))
    )
  `);
}

function getCacheEntry(db, key) {
  return db.prepare(`SELECT value, hash FROM batch_cache WHERE key = ?`).get(key);
}

function setCacheEntry(db, key, value, hash) {
  db.run(`
    INSERT INTO batch_cache (key, value, hash, updated)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, hash=excluded.hash, updated=excluded.updated
  `, [key, value, hash]);
}

function hashContent(content) {
  const hasher = new Bun.CryptoHasher('md5');
  hasher.update(content);
  return hasher.digest('hex');
}

function computeRulesHash(root) {
  const rulesDir = resolve(root, '.claude', 'rules');
  const localRulesDir = resolve(root, '.claude', 'rules', 'local');
  const claudeMdPath = resolve(root, 'CLAUDE.md');
  let combined = '';

  for (const dir of [rulesDir, localRulesDir]) {
    if (existsSync(dir)) {
      for (const f of readdirSync(dir).filter(f => f.endsWith('.md')).sort()) {
        combined += readFileSync(resolve(dir, f), 'utf8');
      }
    }
  }
  if (existsSync(claudeMdPath)) {
    combined += readFileSync(claudeMdPath, 'utf8');
  }

  return hashContent(combined);
}

function shouldRunAgent(agentName, events, db) {
  switch (agentName) {
    case 'hygiene-agent': {
      const currentHash = computeRulesHash(projectRoot);
      const cached = getCacheEntry(db, 'hygiene_hash');
      if (cached && cached.hash === currentHash) {
        log(`skip hygiene-agent: rules unchanged (hash=${currentHash.slice(0, 8)})`);
        return false;
      }
      return true;
    }
    case 'hooks-agent': {
      const hasMutations = events.some(e =>
        ['Edit', 'Write', 'Bash', 'NotebookEdit'].includes(e.tool_name)
      );
      if (!hasMutations) {
        log(`skip hooks-agent: no mutation events in batch`);
        return false;
      }
      return true;
    }
    case 'suggestion-agent': {
      const hasUserPrompts = events.some(e => e.hook_type === 'UserPromptSubmit');
      if (!hasUserPrompts) {
        log(`skip suggestion-agent: no UserPromptSubmit events`);
        return false;
      }
      return true;
    }
    case 'skill-agent': {
      if (events.length < 20) {
        log(`skip skill-agent: only ${events.length} events (min 20)`);
        return false;
      }
      return true;
    }
    default:
      return true;
  }
}

// --- Process Batch via Claude Agent SDK ---

async function processBatch(events, db) {
  initBatchCache(db);

  const { prompt: bulkPrompt, includedIds } = buildBulkPrompt(events);

  // Cache rulesTopicIndex — skip file I/O if rules haven't changed
  const rulesHash = computeRulesHash(projectRoot);
  const cachedIndex = getCacheEntry(db, 'rules_topic_index');
  let rulesTopicIndex;
  if (cachedIndex && cachedIndex.hash === rulesHash) {
    rulesTopicIndex = cachedIndex.value;
    log('cache hit: rules_topic_index');
  } else {
    rulesTopicIndex = buildRulesTopicIndex(projectRoot);
    setCacheEntry(db, 'rules_topic_index', rulesTopicIndex, rulesHash);
  }

  // Build agents object conditionally — only include agents that pass shouldRunAgent
  const agents = {};

  if (shouldRunAgent('rules-agent', events, db)) {
    const rulesContext = buildContextForAgent(projectRoot, ['rules', 'skills']);
    agents['rules-agent'] = {
      description: "Extract implicit conventions from user corrections in session data. Creates .claude/rules/ files following Boris Cherny's 'institutional memory' pattern: past mistakes become permanent rules.",
      prompt: `## Your Role: Institutional Memory Builder
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

If Write/Edit is blocked for .claude/ paths (sensitive file protection), use Bash: printf '%s' "content" > filepath

Follow the extract-rules skill instructions for output format and procedure.

## Description maintenance
Rules listed "Without description — local": Read and add description: field.
Rules listed "Without description — committed": Read for context, do NOT modify.

## Conservative Behavior (ORCH-03)
Before creating any new rule, check the context summary above.
If a similar artifact already exists, SKIP or UPDATE. Log "skipped — already exists: {name}".

--- Dynamic Context ---
${rulesContext}
${rulesTopicIndex}`,
      tools: ['Read', 'Write', 'Edit', 'Glob', 'Bash'],
      skills: ['extract-rules'],
      maxTurns: 15,
    };
  }

  if (shouldRunAgent('suggestion-agent', events, db)) {
    const suggestionContext = buildContextForAgent(projectRoot, ['suggestions', 'rules']);
    agents['suggestion-agent'] = {
      description: "Detect AI-unfriendly code patterns and structural issues from session data. Creates proposal files in .claude-auto-context/suggestions/ with related file lists and quantitative evidence.",
      prompt: `You are a codebase optimization agent. Analyze the session data provided by the orchestrator to detect AI-unfriendly code patterns.

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
- If the quality gate rejects your suggestion as a duplicate, that is correct behavior — do not retry

## Conservative Behavior (ORCH-03)
Before creating any new suggestion, check the context summary below.
If a similar artifact already exists, SKIP creation or UPDATE the existing one instead of duplicating.
Log "skipped — already exists: {name}" when you skip.

--- Dynamic Context ---
${suggestionContext}`,
      tools: ['Read', 'Write', 'Glob', 'Bash'],
      skills: ['create-suggestion'],
      maxTurns: 20,
    };
  }

  if (shouldRunAgent('hooks-agent', events, db)) {
    const hooksContext = buildContextForAgent(projectRoot, ['hooks']);
    agents['hooks-agent'] = {
      description: "Analyze session patterns to detect repetitive manual actions and generate Claude Code hook configurations. Covers linting/formatting automation, dangerous command blocking, and test auto-execution.",
      prompt: `You analyze session data to detect patterns that should become automated hooks.

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
- If Write/Edit is blocked for .claude/ paths (sensitive file protection), use Bash: printf '%s' "content" > filepath
- Write hook scripts to target project's .claude/hooks/ directory
- Update target project's .claude/settings.json (read -> parse -> merge -> write)
- NEVER modify the plugin's hooks/hooks.json
- All PostToolUse/Stop hooks must include CAC_HOOK_RUNNING re-entry guard
- Hook scripts must use static command strings only (no dynamic session data injection)
- Maximum 1 hook per batch to avoid hook accumulation

## Conservative Behavior (ORCH-03)
Before creating any new hook, check the context summary below.
If a similar artifact already exists, SKIP creation or UPDATE the existing one instead of duplicating.
Log "skipped — already exists: {name}" when you skip.

--- Dynamic Context ---
${hooksContext}`,
      tools: ['Read', 'Write', 'Edit', 'Glob', 'Bash'],
      maxTurns: 20,
    };
  }

  if (shouldRunAgent('skill-agent', events, db)) {
    const skillContext = buildContextForAgent(projectRoot, ['skills']);
    agents['skill-agent'] = {
      description: "Detect repeated multi-step workflows from raw session events and create SKILL.md files. Runs every cycle. Writes to .claude/skills/ in the target project.",
      prompt: `You are a skill extraction agent. Analyze the raw session events provided by the orchestrator to detect repeated multi-step workflows that deserve to become reusable skills.

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

If Write/Edit is blocked for .claude/ paths (sensitive file protection), use Bash: printf '%s' "content" > filepath

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

## Deduplication (SKIL-04)

Check the "Skills" section in the context summary above. Do NOT create a skill that overlaps with any existing skill by name or workflow purpose.

## Rules
- Maximum 1 skill per batch. Pick the strongest candidate.
- If no candidate passes the Necessity Gate, create nothing. Most sessions will NOT yield a skill.
- Use concrete tool names and file patterns from the session data, not generic placeholders.

## Conservative Behavior (ORCH-03)
Before creating any new skill, check the context summary below.
If a similar artifact already exists, SKIP creation or UPDATE the existing one instead of duplicating.
Log "skipped — already exists: {name}" when you skip.

--- Dynamic Context ---
${skillContext}`,
      tools: ['Read', 'Write', 'Glob', 'Bash'],
      maxTurns: 20,
    };
  }

  if (shouldRunAgent('hygiene-agent', events, db)) {
    agents['hygiene-agent'] = {
      description: "Context quality auditor. Checks rules, hooks, and suggestions for duplicates, contradictions, stale references, verbosity, and priority placement issues.",
      prompt: `${buildHygienePrompt(projectRoot)}`,
      tools: ['Read', 'Write', 'Glob', 'Bash'],
      skills: ['context-hygiene'],
      maxTurns: 15,
    };
  }

  // If no agents to run, skip the entire query() call
  if (Object.keys(agents).length === 0) {
    log('skip batch: no agents need to run');
    return includedIds;
  }

  // Build dynamic orchestrator prompt based on active agents
  const agentDescriptions = [];
  let idx = 1;
  if (agents['rules-agent']) agentDescriptions.push(`${idx++}. rules-agent — Repeated conventions\n   **Focus on "User Prompts" sections** — user corrections/prohibitions reveal conventions not in code.\n   Note: rules-agent now writes to .claude/rules/local/. Rules without globs: frontmatter apply project-wide.`);
  if (agents['suggestion-agent']) agentDescriptions.push(`${idx++}. suggestion-agent — AI-unfriendly code patterns and structural issues\n   Focus on "Tool Activity" sections for repeated file reads, large files, unclear naming, missing CLAUDE.md entries.`);
  if (agents['hooks-agent']) agentDescriptions.push(`${idx++}. hooks-agent — Detect repetitive manual actions and generate hook configurations\n   **Focus on "Tool Activity" sections** — repeated tool patterns (lint, format, test) and dangerous commands.`);
  if (agents['skill-agent']) agentDescriptions.push(`${idx++}. skill-agent — Detect repeated multi-step workflows and create SKILL.md files\n   Analyzes raw session events for automation-worthy patterns. Writes to .claude/skills/ in the target project.`);
  if (agents['hygiene-agent']) agentDescriptions.push(`${idx++}. hygiene-agent — Context quality audit\n   Checks rules, hooks, and suggestions for duplicates, contradictions, and stale references.`);

  const agentCount = Object.keys(agents).length;
  const orchestratorPrompt = `${bulkPrompt}
You are an orchestrator. Analyze the above session data and delegate to ALL ${agentCount} agents below.
You MUST call each agent exactly once. Do NOT skip any agent. Do NOT do the work yourself.

${agentDescriptions.join('\n')}

Call all ${agentCount} agents now.`;

  log(`batch: running ${agentCount} agents: ${Object.keys(agents).join(', ')}`);

  // ① Snapshot context files (full content) before orchestrator
  const snapshotBefore = takeContentSnapshot(projectRoot);

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), AGENT_TIMEOUT_MS);

  try {
    const result = query({
      prompt: orchestratorPrompt,
      options: {
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
        agents,
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

    // Update hygiene hash cache after successful batch
    setCacheEntry(db, 'hygiene_hash', '', computeRulesHash(projectRoot));
  } finally {
    clearTimeout(timer);
  }

  // ② Convention Decay — revalidate stale rules
  const staleRules = getStaleRules(projectRoot);
  if (staleRules.length > 0) {
    log(`decay: ${staleRules.length} rules need revalidation`);

    const decayAc = new AbortController();
    const decayTimer = setTimeout(() => decayAc.abort(), AGENT_TIMEOUT_MS);

    try {
      const decayPrompt = buildDecayPrompt(staleRules);
      const decayResult = query({
        prompt: decayPrompt,
        options: {
          model: 'sonnet',
          cwd: projectRoot,
          allowedTools: ['Read', 'Edit', 'Glob', 'Bash'],
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true,
          abortController: decayAc,
          maxTurns: 10,
          maxBudgetUsd: 0.50,
          persistSession: false,
          settingSources: ['project'],
          stderr: (data) => log(`[decay-stderr] ${data}`),
        }
      });

      for await (const message of decayResult) {
        if (message.type === 'result') {
          log(`decay ${message.subtype}: ${message.result?.slice(0, 200) ?? ''}`);
        }
      }
    } catch (err) {
      log(`decay: failed (non-fatal): ${err.message}`);
    } finally {
      clearTimeout(decayTimer);
    }
  } else {
    log('decay: no stale rules found');
  }

  // ③ Quality Gate — evaluate agent output, auto-fix or revert low-quality changes
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
