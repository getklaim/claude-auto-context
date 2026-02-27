#!/usr/bin/env bun
// worker.mjs — SQLite Polling Worker (Claim-Confirm queue pattern)
// Polls raw_events, processes via stub consumer, manages lifecycle.
// Uses bun:sqlite — zero native dependencies.

import { Database } from 'bun:sqlite';
import { existsSync, writeFileSync, unlinkSync, appendFileSync } from 'fs';
import { resolve } from 'path';

const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const dbDir = resolve(projectRoot, '.claude-auto-context', 'db');
const dbPath = resolve(dbDir, 'claude-auto-context.db');
const lockPath = resolve(projectRoot, '.claude-auto-context', 'worker.lock');
const logPath = resolve(dbDir, 'worker.log');

const POLL_INTERVAL_MS = 30_000;     // 30s between polls when idle
const IDLE_TIMEOUT_MS = 5 * 60_000;  // 5min idle → exit
const STALE_THRESHOLD_S = 60;        // 60s → self-heal
const MAX_RETRIES = 3;

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

function claim(db) {
  // Atomic claim: pending → processing
  const row = db.prepare(`
    UPDATE raw_events
    SET status = 'processing', claimed_at = datetime('now')
    WHERE id = (
      SELECT id FROM raw_events
      WHERE status = 'pending'
      ORDER BY id ASC
      LIMIT 1
    )
    RETURNING *
  `).get();

  return row || null;
}

function confirm(db, id) {
  db.run(`UPDATE raw_events SET status = 'done' WHERE id = ?`, [id]);
}

function reject(db, id) {
  db.run(`
    UPDATE raw_events
    SET status = 'pending', claimed_at = NULL, retry_count = retry_count + 1
    WHERE id = ?
  `, [id]);
}

// --- AsyncGenerator Polling Loop ---

async function* pollEvents(db) {
  let lastEventTime = Date.now();

  while (true) {
    selfHeal(db);
    const event = claim(db);

    if (event) {
      lastEventTime = Date.now();
      yield event;
    } else {
      // No pending events
      const idleMs = Date.now() - lastEventTime;
      if (idleMs >= IDLE_TIMEOUT_MS) {
        log(`idle timeout (${Math.round(idleMs / 1000)}s) — shutting down`);
        return;
      }
      // Sleep before next poll
      await Bun.sleep(POLL_INTERVAL_MS);
    }
  }
}

// --- Lifecycle ---

function cleanup() {
  try { unlinkSync(lockPath); } catch {}
  log('worker stopped, lock removed');
}

async function main() {
  // Check DB exists
  if (!existsSync(dbPath)) {
    console.error(`DB not found: ${dbPath}`);
    process.exit(1);
  }

  // Write lock file with PID
  writeFileSync(lockPath, String(process.pid));
  log(`worker started (pid=${process.pid})`);

  // Signal handlers
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });
  process.on('SIGINT', () => { cleanup(); process.exit(0); });

  const db = new Database(dbPath);
  db.run('PRAGMA journal_mode = WAL');

  try {
    for await (const event of pollEvents(db)) {
      // --- Stub consumer: log + confirm ---
      log(`processing event #${event.id} [${event.hook_type}${event.tool_name ? ':' + event.tool_name : ''}]`);
      confirm(db, event.id);
      log(`confirmed event #${event.id}`);
    }
  } catch (err) {
    log(`fatal error: ${err.message}`);
  } finally {
    db.close();
    cleanup();
  }
}

main();
