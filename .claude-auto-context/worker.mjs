#!/usr/bin/env bun
// worker.mjs — SQLite Polling Worker (Claim-Confirm queue pattern)
// Polls raw_events, processes batches via Claude Code subprocess (Agent SDK),
// extracts conventions and writes .claude/rules/*.md files.
// Uses bun:sqlite — zero native dependencies.

import { Database } from 'bun:sqlite';
import { existsSync, writeFileSync, unlinkSync, appendFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { query } from '@anthropic-ai/claude-agent-sdk';

// Prevent "cannot be launched inside another Claude Code session" error
delete process.env.CLAUDECODE;

const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const dbDir = resolve(projectRoot, '.claude-auto-context', 'db');
const dbPath = resolve(dbDir, 'claude-auto-context.db');
const lockPath = resolve(projectRoot, '.claude-auto-context', 'worker.lock');
const logPath = resolve(dbDir, 'worker.log');

const POLL_INTERVAL_MS = 30_000;     // 30s between polls when idle
const IDLE_TIMEOUT_MS = 5 * 60_000;  // 5min idle → exit
const STALE_THRESHOLD_S = 60;        // 60s → self-heal
const MAX_RETRIES = 3;
const AGENT_TIMEOUT_MS = 3 * 60_000; // 3min per agent session

// --- Logging ---

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  try { appendFileSync(logPath, line); } catch {}
}

// --- Queue Operations ---

function selfHeal(db) {
  // Recover stale processing events (>60s)
  const healed = db.run(`
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
    for (const e of evts) {
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
  return out;
}

// --- Process Batch via Claude Agent SDK ---

async function processBatch(events) {
  const bulkPrompt = buildBulkPrompt(events);

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), AGENT_TIMEOUT_MS);

  try {
    const result = query({
      prompt: `${bulkPrompt}

You are an orchestrator. Analyze the above session data and delegate to the appropriate agents:
1. Repeated conventions (2+ sessions) → rules-agent
2. Structural issues (file bloat, misorganization) → offer-agent
3. Missing tacit knowledge for CLAUDE.md → claudemd-agent
Delegate to the appropriate agents. Do NOT do the work yourself.`,
      options: {
        model: 'sonnet',
        cwd: projectRoot,
        allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Task'],
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        abortController: ac,
        maxTurns: 15,
        maxBudgetUsd: 1.00,
        persistSession: false,
        settingSources: ['project'],
        stderr: (data) => log(`[stderr] ${data}`),
        agents: {
          "rules-agent": {
            description: "Extract conventions and implicit knowledge from session data into .claude/rules/ files. Use when repeated patterns are found across 2+ sessions.",
            prompt: "Follow the extract-rules skill instructions precisely. Analyze the session data provided by the orchestrator and create/update glob-scoped rules files.",
            tools: ['Read', 'Write', 'Edit', 'Glob'],
            skills: ['extract-rules'],
            maxTurns: 10,
          },
          "offer-agent": {
            description: "Detect structural issues and create proposal files in .claude-auto-context/offers/. Use when file splits, directory reorganization, or pattern changes are needed.",
            prompt: "Follow the create-offer skill instructions precisely. Analyze the session data provided by the orchestrator and create offer files with quantitative evidence.",
            tools: ['Read', 'Write', 'Glob'],
            skills: ['create-offer'],
            maxTurns: 10,
          },
          "claudemd-agent": {
            description: "Update CLAUDE.md with non-obvious execution methods and project-wide tacit knowledge. Use when essential information is missing that every session needs.",
            prompt: "Follow the update-claudemd skill instructions precisely. Analyze the session data and add minimal, high-value information to CLAUDE.md. Maximum 3 lines per update.",
            tools: ['Read', 'Edit'],
            skills: ['update-claudemd'],
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
  mkdirSync(resolve(projectRoot, '.claude', 'rules'), { recursive: true });
  mkdirSync(resolve(projectRoot, '.claude-auto-context', 'offers'), { recursive: true });

  let lastEventTime = Date.now();

  try {
    while (true) {
      const batch = claimBatch(db);
      if (batch.length > 0) {
        lastEventTime = Date.now();
        log(`claimed ${batch.length} events`);
        try {
          await processBatch(batch);
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
