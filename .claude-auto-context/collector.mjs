#!/usr/bin/env node
// collector.mjs — Hook to SQLite relay
// Parses raw JSON from stdin and inserts into SQLite.
// No analysis, no summarization. Just store.

import { createRequire } from 'module';
import { mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const __dirname = dirname(fileURLToPath(import.meta.url));
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
    db.pragma('journal_mode = WAL');

    // Create table if missing
    db.exec(`
      CREATE TABLE IF NOT EXISTS raw_events (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id  TEXT NOT NULL,
        timestamp   TEXT NOT NULL,
        hook_type   TEXT NOT NULL,
        tool_name   TEXT,
        payload     TEXT NOT NULL,
        processed   INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_raw_events_processed
        ON raw_events(processed);
      CREATE INDEX IF NOT EXISTS idx_raw_events_session
        ON raw_events(session_id);
    `);

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
