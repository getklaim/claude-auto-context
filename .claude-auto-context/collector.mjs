#!/usr/bin/env bun
// collector.mjs — Hook to SQLite relay
// Parses raw JSON from stdin, compresses PostToolUse payloads at ingestion,
// and inserts into SQLite. UserPromptSubmit payloads are stored uncompressed
// to preserve user intent. Stop events are skipped entirely.
// Uses bun:sqlite — zero native dependencies.

import { Database } from 'bun:sqlite';
import { mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

const hookType = process.argv[2]; // 'PostToolUse' | 'Stop' | 'SessionStart' | 'UserPromptSubmit'

if (!hookType) {
  process.exit(1);
}

// Skip Stop events — they only contain last_assistant_message which is never used
if (hookType === 'Stop') {
  process.exit(0);
}

// --- Payload compression (mirrors worker.mjs compressPayload) ---
// Strips tool_response (stdout, file contents, grep matches) at ingestion time.
// Only keeps what the worker actually uses: tool name + input metadata.
function compressPostToolUse(payload) {
  const toolName = payload.tool_name;
  const input = payload.tool_input || {};

  switch (toolName) {
    case 'Read':
      return JSON.stringify({ tool_name: toolName, file_path: input.file_path || '(unknown)' });
    case 'Bash':
      return JSON.stringify({ tool_name: toolName, command: input.command || '(unknown)' });
    case 'Grep':
      return JSON.stringify({ tool_name: toolName, pattern: input.pattern || '', path: input.path || '.' });
    case 'Glob':
      return JSON.stringify({ tool_name: toolName, pattern: input.pattern || '' });
    case 'WebFetch':
      return JSON.stringify({ tool_name: toolName, url: input.url || '(unknown)' });
    case 'Agent':
    case 'Task':
    case 'TaskCreate':
    case 'TaskUpdate':
    case 'TaskGet':
    case 'AskUserQuestion':
    case 'WebSearch':
      return null; // skip entirely — not used by worker
    case 'Write':
    case 'Edit':
      // Keep file_path + truncated content (what was changed matters for rules-agent)
      return JSON.stringify({
        tool_name: toolName,
        file_path: input.file_path || '(unknown)',
        content_preview: (input.content || input.new_string || '').slice(0, 500),
      });
    default:
      // Unknown tools: keep full payload but cap at 2000 chars
      return JSON.stringify(payload).slice(0, 2000);
  }
}

// DB path: .claude-auto-context/db/ inside the project that uses this plugin
const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const dbDir = resolve(projectRoot, '.claude-auto-context', 'db');
const dbPath = resolve(dbDir, 'claude-auto-context.db');

// Read JSON from stdin
const chunks = [];
process.stdin.on('data', (chunk) => chunks.push(chunk));
process.stdin.on('end', () => {
  try {
    const raw = Buffer.concat(chunks).toString();
    if (!raw.trim()) {
      process.exit(0);
    }

    const payload = JSON.parse(raw);

    // Create DB directory if missing
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    const db = new Database(dbPath);
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA busy_timeout = 2000');

    // Create table if missing — Claim-Confirm queue schema
    db.run(`
      CREATE TABLE IF NOT EXISTS raw_events (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id  TEXT NOT NULL,
        timestamp   TEXT NOT NULL,
        hook_type   TEXT NOT NULL,
        tool_name   TEXT,
        payload     TEXT NOT NULL,
        status      TEXT DEFAULT 'pending',
        claimed_at  TEXT,
        retry_count INTEGER DEFAULT 0
      )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_raw_events_status ON raw_events(status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_raw_events_session ON raw_events(session_id)`);

    // Determine stored payload based on hook type
    let storedPayload;
    if (hookType === 'UserPromptSubmit') {
      // User prompts: store full payload — intent must be preserved
      storedPayload = JSON.stringify(payload);
    } else if (hookType === 'PostToolUse') {
      // Tool events: compress at ingestion — strip tool_response
      const compressed = compressPostToolUse(payload);
      if (compressed === null) {
        // Skip this event entirely (Agent, Task, etc.)
        db.close();
        process.exit(0);
      }
      storedPayload = compressed;
    } else {
      // Other hook types: store as-is with 2000 char cap
      storedPayload = JSON.stringify(payload).slice(0, 2000);
    }

    // Dedup: for Edit/Write on same file in same session, replace previous pending event
    // This prevents bulk prompt bloat from repeated edits to the same file
    const sessionId = payload.session_id ?? 'unknown';
    const toolName = payload.tool_name ?? null;

    if (hookType === 'PostToolUse' && (toolName === 'Edit' || toolName === 'Write')) {
      const filePath = (payload.tool_input || {}).file_path || null;
      if (filePath) {
        db.run(`
          DELETE FROM raw_events
          WHERE session_id = ? AND tool_name = ? AND status = 'pending'
            AND json_extract(payload, '$.file_path') = ?
        `, [sessionId, toolName, filePath]);
      }
    }

    const stmt = db.prepare(`
      INSERT INTO raw_events (session_id, timestamp, hook_type, tool_name, payload)
      VALUES (?, datetime('now'), ?, ?, ?)
    `);

    stmt.run(
      sessionId,
      hookType,
      toolName,
      storedPayload
    );

    db.close();
  } catch (e) {
    // Never block the main session. Silently exit on error.
    process.exit(0);
  }
});
