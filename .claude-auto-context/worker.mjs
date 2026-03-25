#!/usr/bin/env bun
// worker.mjs — SQLite Polling Worker (Claim-Confirm queue pattern)
// Polls raw_events, processes batches via Claude Code subprocess (Agent SDK),
// extracts conventions and writes .claude/rules/local/*.md files.
// Uses bun:sqlite — zero native dependencies.

import { Database } from 'bun:sqlite';
import { existsSync, writeFileSync, unlinkSync, appendFileSync, mkdirSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { takeContentSnapshot, hasContentChanged, runQualityGate } from './quality-gate.mjs';
import { runSkillDetector } from './skill-detector.mjs';

// Prevent "cannot be launched inside another Claude Code session" error
delete process.env.CLAUDECODE;

const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const dbDir = resolve(projectRoot, '.claude-auto-context', 'db');
const dbPath = resolve(dbDir, 'claude-auto-context.db');
const lockPath = resolve(projectRoot, '.claude-auto-context', 'worker.lock');
const logPath = resolve(dbDir, 'worker.log');

const POLL_INTERVAL_MS = 30_000;     // 30s between polls when idle
const IDLE_TIMEOUT_MS = 5 * 60_000;  // 5min idle → exit
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

// --- Context Threshold Check (for hygiene-agent trigger) ---

function shouldRunHygiene(root) {
  const rulesDir = resolve(root, '.claude', 'rules');
  const localRulesDir = resolve(root, '.claude', 'rules', 'local');

  let rulesCount = 0;
  if (existsSync(rulesDir)) {
    rulesCount += readdirSync(rulesDir).filter(f => f.endsWith('.md')).length;
  }
  if (existsSync(localRulesDir)) {
    rulesCount += readdirSync(localRulesDir).filter(f => f.endsWith('.md')).length;
  }

  return rulesCount >= 2;
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

// --- Observations (Cross-Cycle Memory) ---

const OBSERVATIONS_FILE = resolve(projectRoot, '.claude-auto-context', 'pending-observations.json');

function buildObservationsContext(db) {
  const rows = db.prepare(`
    SELECT pattern_key, GROUP_CONCAT(DISTINCT session_id) AS sessions,
           COUNT(DISTINCT session_id) AS session_count,
           GROUP_CONCAT(evidence, ' | ') AS evidences,
           agent_source
    FROM observations
    GROUP BY pattern_key
    ORDER BY session_count DESC, MAX(created_at) DESC
  `).all();

  if (rows.length === 0) return '';

  let out = `\n# Cross-Cycle Observations (${rows.length} patterns from previous cycles)\n`;
  out += `These are candidate patterns observed in prior poll cycles but not yet promoted to rules/hooks.\n`;
  out += `Use these to judge whether a pattern in the current batch reaches the 2+ session threshold.\n\n`;

  for (const r of rows) {
    out += `- **${r.pattern_key}** (${r.session_count} sessions: ${r.sessions})\n`;
    out += `  Evidence: ${r.evidences.slice(0, 500)}\n`;
    out += `  Source: ${r.agent_source}\n`;
  }
  return out;
}

function collectObservations(db) {
  if (!existsSync(OBSERVATIONS_FILE)) return;
  try {
    const raw = readFileSync(OBSERVATIONS_FILE, 'utf8');
    const entries = JSON.parse(raw);
    if (!Array.isArray(entries)) return;

    const stmt = db.prepare(`
      INSERT OR IGNORE INTO observations (pattern_key, session_id, evidence, agent_source)
      VALUES (?, ?, ?, ?)
    `);
    db.transaction(() => {
      for (const e of entries) {
        if (e.pattern_key && e.session_id && e.evidence && e.agent_source) {
          stmt.run(e.pattern_key, e.session_id, e.evidence, e.agent_source);
        }
      }
    })();
    unlinkSync(OBSERVATIONS_FILE);
    log(`observations: collected ${entries.length} entries`);
  } catch (err) {
    log(`observations: failed to collect: ${err.message}`);
    try { unlinkSync(OBSERVATIONS_FILE); } catch {}
  }
}

// --- Bulk Prompt Builder ---

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
    const toolActivity = evts.filter(e => e.hook_type !== 'UserPromptSubmit' && e.hook_type !== 'Stop');
    const stopEvents = evts.filter(e => e.hook_type === 'Stop');

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
        let p = e.payload.length > MAX_PAYLOAD
          ? e.payload.slice(0, MAX_PAYLOAD) + '...[truncated]' : e.payload;
        const line = `- [${e.hook_type}${e.tool_name ? ':' + e.tool_name : ''}] ${p}\n`;
        if (total + line.length > MAX_TOTAL) {
          out += '\n[...truncated due to size limit]\n';
          return out;
        }
        out += line;
        total += line.length;
      }
    }

    // Session End section
    if (stopEvents.length > 0) {
      out += `### Session End\n`;
      for (const e of stopEvents) {
        let p = e.payload.length > MAX_PAYLOAD
          ? e.payload.slice(0, MAX_PAYLOAD) + '...[truncated]' : e.payload;
        const line = `- [Stop] ${p}\n`;
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
\`.claude-auto-context/suggestions/YYYYMMDD-HHMMSS-hygiene-{slug}.md\`

Use current UTC time for the timestamp (e.g. 20260323-143052).

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
\`.claude-auto-context/suggestions/YYYYMMDD-HHMMSS-hygiene-{slug}.md\`

Use exactly this format:

\`\`\`markdown
# Suggestion: {descriptive title}

## Status
pending

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
  const observationsContext = buildObservationsContext(db);

  // ① Snapshot context files (full content) before orchestrator
  const snapshotBefore = takeContentSnapshot(projectRoot);

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), AGENT_TIMEOUT_MS);

  try {
    const result = query({
      prompt: `${bulkPrompt}
${observationsContext}
You are an orchestrator. Analyze the above session data and delegate to ALL THREE agents below.
You MUST call each agent exactly once. Do NOT skip any agent. Do NOT do the work yourself.

1. rules-agent — Repeated conventions (2+ sessions)
   **Focus on "User Prompts" sections** — user corrections/prohibitions reveal conventions not in code.
   Has access to cross-cycle observations from previous batches.
   Note: rules-agent now writes to .claude/rules/local/. Rules without globs: frontmatter apply project-wide (replacing CLAUDE.md additions for global knowledge).
2. suggestion-agent — Structural issues (file bloat, misorganization)
   Focus on "Tool Activity" sections for file patterns and structural signals (e.g. same large file read repeatedly).
3. hooks-agent — Detect repetitive manual actions and generate hook configurations
   **Focus on "Tool Activity" sections** — repeated tool patterns (lint, format, test) and dangerous commands.
   Has access to cross-cycle observations from previous batches.

Call all three agents now.`,
      options: {
        model: 'sonnet',
        cwd: projectRoot,
        allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Task'],
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        abortController: ac,
        maxTurns: 20,
        maxBudgetUsd: 1.00,
        persistSession: false,
        settingSources: ['project'],
        stderr: (data) => log(`[stderr] ${data}`),
        agents: {
          "rules-agent": {
            description: "Extract conventions and implicit knowledge from session data into .claude/rules/ files. Use when repeated patterns are found across 2+ sessions.",
            prompt: `Follow the extract-rules skill instructions precisely. Analyze the session data provided by the orchestrator and create/update glob-scoped rules files.
${observationsContext}
After analysis, write any new candidate patterns (not yet at 2+ sessions) to .claude-auto-context/pending-observations.json as a JSON array:
[{"pattern_key": "descriptive-key", "session_id": "sid", "evidence": "what you saw", "agent_source": "rules-agent"}]
If the file already exists, read it first and append.`,
            tools: ['Read', 'Write', 'Edit', 'Glob'],
            skills: ['extract-rules'],
            maxTurns: 10,
          },
          "suggestion-agent": {
            description: "Detect structural issues and create proposal files in .claude-auto-context/suggestions/. Use when file splits, directory reorganization, or pattern changes are needed.",
            prompt: "Follow the create-suggestion skill instructions precisely. Analyze the session data provided by the orchestrator and create suggestion files with quantitative evidence.",
            tools: ['Read', 'Write', 'Glob'],
            skills: ['create-suggestion'],
            maxTurns: 10,
          },
          "hooks-agent": {
            description: "Analyze session patterns to detect repetitive manual actions and generate Claude Code hook configurations. Covers linting/formatting automation, dangerous command blocking, and test auto-execution.",
            prompt: `You analyze session data to detect patterns that should become automated hooks.
${observationsContext}
## What to detect

1. **Formatter/Linter patterns**: Same lint/format command run manually after edits (eslint, prettier, black, gofmt)
   → Generate PostToolUse:Edit|Write hook to auto-run
2. **Dangerous commands**: rm -rf, git push --force, git reset --hard, DROP TABLE
   → Generate PreToolUse:Bash hook with exit 2 to block
3. **Secret/credential writes**: .env, .pem, .key files being written
   → Generate PreToolUse:Write|Edit hook with exit 2 to block
4. **Test-before-stop**: Test suite run at session end repeatedly
   → Generate Stop hook to auto-run tests

## Threshold rules
- Formatter/linter: need 3+ sessions (check observations for cross-cycle count)
- Dangerous commands: generate immediately (zero-tolerance)
- Secret writes: generate immediately (zero-tolerance)
- Test patterns: need 3+ sessions

## Output rules
- Write hook scripts to target project's .claude/hooks/ directory
- Update target project's .claude/settings.json (read → parse → merge → write)
- NEVER modify the plugin's hooks/hooks.json
- All PostToolUse/Stop hooks must include CAC_HOOK_RUNNING re-entry guard
- Hook scripts must use static command strings only (no dynamic session data injection)
- Maximum 1 hook per batch to avoid hook accumulation

## Observations
After analysis, write any new candidate patterns (not yet at threshold) to .claude-auto-context/pending-observations.json as a JSON array:
[{"pattern_key": "descriptive-key", "session_id": "sid", "evidence": "what you saw", "agent_source": "hooks-agent"}]
If the file already exists, read it first and append.`,
            tools: ['Read', 'Write', 'Edit', 'Glob'],
            maxTurns: 10,
          },
        },
      }
    });

    for await (const message of result) {
      if (message.type === 'result') {
        log(`session ${message.subtype}: ${message.result?.slice(0, 200) ?? ''}`);
      }
    }
  } finally {
    clearTimeout(timer);
  }

  // ② Collect observations written by agents (file → DB)
  collectObservations(db);

  // ③ Quality Gate — evaluate agent output, auto-fix or revert low-quality changes
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

  // ②c Skill Detector — deterministic pattern detection (no LLM)
  try {
    const detectorResult = runSkillDetector(events, db);
    log(`skill-detector: ${detectorResult.candidates} candidates, ` +
        `${detectorResult.observations_written} written, ` +
        `${detectorResult.discarded} discarded`);
  } catch (err) {
    log(`skill-detector: failed (non-fatal): ${err.message}`);
  }

  // ④ Check if context still changed after gate (reverts may have undone changes)
  const snapshotAfter = takeContentSnapshot(projectRoot);

  if (!hasContentChanged(snapshotBefore, snapshotAfter)) {
    log('hygiene: no context changes remain after quality gate, skipping');
    return;
  }

  if (!shouldRunHygiene(projectRoot)) {
    log('hygiene: below minimum threshold (< 2 rules files), skipping');
    return;
  }

  log('hygiene: context changes detected, running hygiene-agent');

  const hygieneAc = new AbortController();
  const hygieneTimer = setTimeout(() => hygieneAc.abort(), AGENT_TIMEOUT_MS);

  try {
    const hygienePrompt = buildHygienePrompt(projectRoot);
    const hygieneResult = query({
      prompt: hygienePrompt,
      options: {
        model: 'sonnet',
        cwd: projectRoot,
        allowedTools: ['Read', 'Write', 'Glob'],
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        abortController: hygieneAc,
        maxTurns: 10,
        maxBudgetUsd: 0.50,
        persistSession: false,
        settingSources: ['project'],
        stderr: (data) => log(`[hygiene-stderr] ${data}`),
      }
    });

    for await (const message of hygieneResult) {
      if (message.type === 'result') {
        log(`hygiene ${message.subtype}: ${message.result?.slice(0, 200) ?? ''}`);
      }
    }
  } catch (err) {
    log(`hygiene: failed (non-fatal): ${err.message}`);
  } finally {
    clearTimeout(hygieneTimer);
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

  // Cross-cycle observations table — agent working memory across poll cycles
  db.run(`
    CREATE TABLE IF NOT EXISTS observations (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      pattern_key  TEXT NOT NULL,
      session_id   TEXT NOT NULL,
      evidence     TEXT NOT NULL,
      agent_source TEXT NOT NULL,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(pattern_key, session_id)
    )
  `);

  // On startup, immediately recover ALL orphaned processing events from previous worker
  // This handles crash/SIGKILL scenarios where the previous worker left events stranded
  selfHeal(db, true);
  log('startup: recovered any orphaned processing events');

  let lastEventTime = Date.now();

  try {
    while (true) {
      const batch = claimBatch(db);
      if (batch.length > 0) {
        lastEventTime = Date.now();
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
        if (Date.now() - lastEventTime >= IDLE_TIMEOUT_MS) {
          log(`idle timeout — shutting down`);
          break;
        }
        await Bun.sleep(POLL_INTERVAL_MS);
      }
    }
  } finally {
    db.close();
    cleanup();
  }
}

main();
