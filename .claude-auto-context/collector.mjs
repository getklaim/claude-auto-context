#!/usr/bin/env bun
// collector.mjs — Hook to SQLite relay
// Parses raw JSON from stdin and inserts into SQLite.
// No analysis, no summarization. Just store.
// Uses bun:sqlite — zero native dependencies.

import { Database } from 'bun:sqlite';
import { mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

const hookType = process.argv[2]; // 'PostToolUse' | 'Stop' | 'SessionStart' | 'UserPromptSubmit'

if (!hookType) {
  process.exit(1);
}

// DB path: .claude-auto-context/db/ inside the project that uses this plugin
const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const dbDir = resolve(projectRoot, '.claude-auto-context', 'db');
const dbPath = resolve(dbDir, 'auto-context.db');

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

    // Migrate from old schema (processed column) if needed
    const cols = db.prepare(`PRAGMA table_info(raw_events)`).all();
    const hasProcessed = cols.some(c => c.name === 'processed');
    const hasStatus = cols.some(c => c.name === 'status');

    if (hasProcessed && !hasStatus) {
      db.run(`ALTER TABLE raw_events ADD COLUMN status TEXT DEFAULT 'pending'`);
      db.run(`ALTER TABLE raw_events ADD COLUMN claimed_at TEXT`);
      db.run(`ALTER TABLE raw_events ADD COLUMN retry_count INTEGER DEFAULT 0`);
      db.run(`UPDATE raw_events SET status = 'done' WHERE processed = 1`);
      db.run(`UPDATE raw_events SET status = 'pending' WHERE processed = 0`);
    }

    db.run(`CREATE INDEX IF NOT EXISTS idx_raw_events_status ON raw_events(status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_raw_events_session ON raw_events(session_id)`);

    const stmt = db.prepare(`
      INSERT INTO raw_events (session_id, timestamp, hook_type, tool_name, payload)
      VALUES (?, datetime('now'), ?, ?, ?)
    `);

    stmt.run(
      payload.session_id ?? 'unknown',
      hookType,
      payload.tool_name ?? null,
      JSON.stringify(payload)
    );

    db.close();
  } catch (e) {
    // Never block the main session. Silently exit on error.
    process.exit(0);
  }
});
