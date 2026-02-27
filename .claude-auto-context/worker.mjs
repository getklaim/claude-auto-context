#!/usr/bin/env bun
// worker.mjs — SQLite Polling Worker (Claim-Confirm queue pattern)
// Polls raw_events, processes batches via Claude Code subprocess (Agent SDK),
// extracts conventions and writes .claude/rules/*.md files.
// Uses bun:sqlite — zero native dependencies.

import { Database } from 'bun:sqlite';
import { existsSync, writeFileSync, unlinkSync, appendFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { execSync } from 'child_process';

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

// --- Find Claude Executable ---

function findClaudeExecutable() {
  if (process.env.CLAUDE_CODE_PATH) {
    if (!existsSync(process.env.CLAUDE_CODE_PATH))
      throw new Error(`CLAUDE_CODE_PATH not found: ${process.env.CLAUDE_CODE_PATH}`);
    return process.env.CLAUDE_CODE_PATH;
  }
  try {
    return execSync('which claude', {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
    }).trim().split('\n')[0].trim();
  } catch {}
  throw new Error('Claude executable not found. Set CLAUDE_CODE_PATH or add claude to PATH.');
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
  const claudePath = findClaudeExecutable();
  const bulkPrompt = buildBulkPrompt(events);

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), AGENT_TIMEOUT_MS);

  try {
    const result = query({
      prompt: `${bulkPrompt}\n\nAnalyze the above data and delegate to the appropriate agents: extract conventions (rules-agent), detect structural issues (offer-agent), and update project-wide tacit knowledge (claudemd-agent).`,
      options: {
        model: 'claude-sonnet-4-6',
        cwd: projectRoot,
        allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Task'],
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        abortController: ac,
        pathToClaudeCodeExecutable: claudePath,
        maxTurns: 10,
        maxBudgetUsd: 0.50,
        persistSession: false,
        settingSources: [],
        agents: {
          "rules-agent": {
            description: "Convention과 암묵지를 추출하여 .claude/rules/ 에 rules 파일을 생성/갱신한다. 반복 패턴이 발견될 때 사용.",
            prompt: `프로젝트의 세션 데이터를 분석하여 convention과 암묵지를 추출하고,
.claude/rules/ 에 glob 스코핑된 rules 파일을 생성/갱신하라.
기존 rules와 중복되지 않게 확인 후 작성.
코드베이스를 읽어서 발견 가능한 정보는 추출하지 않는다.
2개 이상 세션에서 반복된 패턴만 stable convention으로 인정한다.
YAML frontmatter 형식: ---\nglobs: "src/auth/**"\n---`,
            tools: ['Read', 'Write', 'Edit', 'Glob'],
          },
          "offer-agent": {
            description: "구조적 문제를 감지하여 .claude-auto-context/offers/ 에 제안 파일을 생성한다. 파일 분할, 디렉토리 재구성 등 구조 변경이 필요할 때 사용.",
            prompt: `프로젝트의 세션 데이터를 분석하여 구조적 문제를 감지하고,
.claude-auto-context/offers/ 에 제안 파일을 생성하라.
파일명 형식: {NNN}-{slug}.md (NNN은 순번).
근거 세션과 수치를 반드시 포함.`,
            tools: ['Read', 'Write', 'Glob'],
          },
          "claudemd-agent": {
            description: "비자명한 실행 방법과 프로젝트 전역 암묵지를 CLAUDE.md에 갱신한다. 매 세션 필요한 정보가 누락되었을 때 사용.",
            prompt: `프로젝트의 세션 데이터를 분석하여 비자명한 실행 방법과
프로젝트 전역 암묵지를 CLAUDE.md에 최소한만 추가/수정하라.
코드에서 발견 가능한 정보는 추가하지 않는다.`,
            tools: ['Read', 'Edit'],
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
