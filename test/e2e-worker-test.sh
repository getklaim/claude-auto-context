#!/usr/bin/env bash
# e2e-worker-test.sh — E2E Worker Pipeline Test (Planted Flag)
# Usage: cd ~/claude-auto-context && bash test/e2e-worker-test.sh
# Usage: bash test/e2e-worker-test.sh --no-cleanup  (keep generated files)
set -euo pipefail

NO_CLEANUP=false
if [ "${1:-}" = "--no-cleanup" ]; then
  NO_CLEANUP=true
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
E2E_DIR="$PROJECT_ROOT/test/e2e-project"
FIXTURES="$PROJECT_ROOT/test/fixtures/sessions.json"
DB_DIR="$E2E_DIR/.claude-auto-context/db"
DB_PATH="$DB_DIR/claude-auto-context.db"
RULES_DIR="$E2E_DIR/.claude/rules"
OFFERS_DIR="$E2E_DIR/.claude-auto-context/offers"
CLAUDEMD="$E2E_DIR/CLAUDE.md"
SKILLS_LINK="$E2E_DIR/.claude/skills"
WORKER="$PROJECT_ROOT/.claude-auto-context/worker.mjs"
WORKER_PID=""
MAX_WAIT=300
POLL_INTERVAL=5

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

PASS_COUNT=0
FAIL_COUNT=0

pass() { echo -e "  ${GREEN}PASS${NC}  $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo -e "  ${RED}FAIL${NC}  $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }

# ── Step 0: Preflight ──────────────────────────────────────────

echo -e "\n${BOLD}══════════════════════════════════════════${NC}"
echo -e "${BOLD}  E2E Worker Pipeline Test${NC}"
echo -e "${BOLD}══════════════════════════════════════════${NC}\n"

if [ -n "${CLAUDECODE:-}" ]; then
  echo -e "${RED}ERROR: CLAUDECODE env var is set.${NC}"
  echo "This test must run from an external terminal, not inside Claude Code."
  exit 1
fi

if ! command -v bun &>/dev/null; then
  echo -e "${RED}ERROR: bun not found${NC}"
  exit 1
fi

if [ ! -f "$WORKER" ]; then
  echo -e "${RED}ERROR: worker.mjs not found at $WORKER${NC}"
  exit 1
fi

if [ ! -f "$FIXTURES" ]; then
  echo -e "${RED}ERROR: sessions.json not found at $FIXTURES${NC}"
  exit 1
fi

echo -e "${CYAN}Preflight checks passed.${NC}\n"

# ── Step 1: Setup ──────────────────────────────────────────────

echo -e "${YELLOW}[Step 1] Setup${NC}"

# Backup CLAUDE.md
cp "$CLAUDEMD" "$CLAUDEMD.bak"

# Initialize test project as independent git repo
# (Agent SDK's claude -p detects git root as project root;
#  without this, it walks up to the main repo and writes there)
if [ ! -d "$E2E_DIR/.git" ]; then
  git -C "$E2E_DIR" init -q
  git -C "$E2E_DIR" add -A
  git -C "$E2E_DIR" commit -q -m "init" --allow-empty
  echo "  git init: test project is now independent repo"
else
  echo "  git: test project already has .git"
fi

# Copy skills into test project (not symlink — avoids path leaking to main repo)
mkdir -p "$E2E_DIR/.claude/skills"
cp -R "$PROJECT_ROOT/.claude/skills/extract-rules" "$E2E_DIR/.claude/skills/"
cp -R "$PROJECT_ROOT/.claude/skills/create-offer" "$E2E_DIR/.claude/skills/"
cp -R "$PROJECT_ROOT/.claude/skills/update-claudemd" "$E2E_DIR/.claude/skills/"
echo "  skills: copied extract-rules, create-offer, update-claudemd"

# Create DB directory & initialize schema
mkdir -p "$DB_DIR"
rm -f "$DB_PATH"

bun -e "
const { Database } = require('bun:sqlite');
const db = new Database('$DB_PATH');
db.run('PRAGMA journal_mode = WAL');
db.run(\`
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
\`);
db.run('CREATE INDEX IF NOT EXISTS idx_raw_events_status ON raw_events(status)');
db.run('CREATE INDEX IF NOT EXISTS idx_raw_events_session ON raw_events(session_id)');
db.close();
console.log('  DB initialized: $DB_PATH');
"

# Ensure output directories are clean
rm -rf "$RULES_DIR"
mkdir -p "$RULES_DIR"
rm -rf "$OFFERS_DIR"
mkdir -p "$OFFERS_DIR"
echo "  output dirs cleaned: rules/, offers/"

# ── Step 2: Snapshot BEFORE ────────────────────────────────────

echo -e "\n${YELLOW}[Step 2] Snapshot BEFORE${NC}"

RULES_BEFORE=$(find "$RULES_DIR" -name '*.md' 2>/dev/null | sort)
OFFERS_BEFORE=$(find "$OFFERS_DIR" -name '*.md' 2>/dev/null | sort)
CLAUDEMD_MD5_BEFORE=$(md5 -q "$CLAUDEMD")

echo "  rules files: $(echo "$RULES_BEFORE" | grep -c '.' || echo 0)"
echo "  offer files: $(echo "$OFFERS_BEFORE" | grep -c '.' || echo 0)"
echo "  CLAUDE.md md5: $CLAUDEMD_MD5_BEFORE"

# ── Step 3: Insert Events ─────────────────────────────────────

echo -e "\n${YELLOW}[Step 3] Insert Events${NC}"

EVENT_COUNT=$(bun -e "
const { Database } = require('bun:sqlite');
const events = JSON.parse(require('fs').readFileSync('$FIXTURES', 'utf8'));
const db = new Database('$DB_PATH');
const stmt = db.prepare(\`
  INSERT INTO raw_events (session_id, timestamp, hook_type, tool_name, payload)
  VALUES (?, datetime('now'), ?, ?, ?)
\`);
db.transaction(() => {
  for (const e of events) {
    stmt.run(e.session_id, e.hook_type, e.tool_name, e.payload);
  }
})();
const count = db.prepare('SELECT COUNT(*) as c FROM raw_events').get().c;
db.close();
console.log(count);
")

echo "  Inserted $EVENT_COUNT events into DB"

# ── Step 4: Run Worker ─────────────────────────────────────────

echo -e "\n${YELLOW}[Step 4] Run Worker${NC}"

# Cleanup function
cleanup() {
  if [ -n "$WORKER_PID" ] && kill -0 "$WORKER_PID" 2>/dev/null; then
    echo -e "\n  Stopping worker (pid=$WORKER_PID)..."
    kill "$WORKER_PID" 2>/dev/null || true
    wait "$WORKER_PID" 2>/dev/null || true
  fi
  if $NO_CLEANUP; then
    echo "  --no-cleanup: generated files preserved in $E2E_DIR"
    return
  fi
  # Restore CLAUDE.md
  if [ -f "$CLAUDEMD.bak" ]; then
    cp "$CLAUDEMD.bak" "$CLAUDEMD"
    rm "$CLAUDEMD.bak"
  fi
  # Remove copied skills
  rm -rf "$E2E_DIR/.claude/skills/extract-rules" "$E2E_DIR/.claude/skills/create-offer" "$E2E_DIR/.claude/skills/update-claudemd"
  # Remove test DB
  rm -rf "$DB_DIR"
  # Remove agent-generated output
  find "$RULES_DIR" -name '*.md' -delete 2>/dev/null || true
  find "$OFFERS_DIR" -name '*.md' -delete 2>/dev/null || true
  echo "  Cleanup complete."
}
trap cleanup EXIT

# Launch worker pointing at test project
CLAUDE_PROJECT_DIR="$E2E_DIR" bun "$WORKER" &
WORKER_PID=$!
echo "  Worker started (pid=$WORKER_PID)"

# Poll for completion
ELAPSED=0
while [ $ELAPSED -lt $MAX_WAIT ]; do
  sleep $POLL_INTERVAL
  ELAPSED=$((ELAPSED + POLL_INTERVAL))

  # Check if worker is still alive
  if ! kill -0 "$WORKER_PID" 2>/dev/null; then
    echo "  Worker exited after ${ELAPSED}s"
    break
  fi

  # Check DB for pending/processing events
  REMAINING=$(bun -e "
    const { Database } = require('bun:sqlite');
    const db = new Database('$DB_PATH');
    const r = db.prepare(\"SELECT COUNT(*) as c FROM raw_events WHERE status IN ('pending','processing')\").get();
    db.close();
    console.log(r.c);
  " 2>/dev/null || echo "?")

  echo "  [${ELAPSED}s] remaining: $REMAINING"

  if [ "$REMAINING" = "0" ]; then
    echo "  All events processed after ${ELAPSED}s"
    # Give worker a moment to finish writing files
    sleep 3
    break
  fi
done

# Kill worker if still running
if kill -0 "$WORKER_PID" 2>/dev/null; then
  echo "  Stopping worker (timeout or complete)..."
  kill "$WORKER_PID" 2>/dev/null || true
  wait "$WORKER_PID" 2>/dev/null || true
fi

# ── Step 5: Snapshot AFTER + Diff ──────────────────────────────

echo -e "\n${YELLOW}[Step 5] Snapshot AFTER${NC}"

RULES_AFTER=$(find "$RULES_DIR" -name '*.md' 2>/dev/null | sort)
OFFERS_AFTER=$(find "$OFFERS_DIR" -name '*.md' 2>/dev/null | sort)
CLAUDEMD_MD5_AFTER=$(md5 -q "$CLAUDEMD")

NEW_RULES=$(comm -13 <(echo "$RULES_BEFORE") <(echo "$RULES_AFTER") | grep '.' || true)
NEW_OFFERS=$(comm -13 <(echo "$OFFERS_BEFORE") <(echo "$OFFERS_AFTER") | grep '.' || true)

echo "  new rules files: $(echo "$NEW_RULES" | grep -c '.' || echo 0)"
echo "  new offer files: $(echo "$NEW_OFFERS" | grep -c '.' || echo 0)"
echo "  CLAUDE.md changed: $([ "$CLAUDEMD_MD5_BEFORE" != "$CLAUDEMD_MD5_AFTER" ] && echo 'yes' || echo 'no')"

# ── Step 6: Judgment — Planted Flag Matching ───────────────────

echo -e "\n${BOLD}──────────────────────────────────────────${NC}"
echo -e "${BOLD}  Results${NC}"
echo -e "${BOLD}──────────────────────────────────────────${NC}"

# L1: Plumbing — all events should be done
eval "$(bun -e "
  const { Database } = require('bun:sqlite');
  const db = new Database('$DB_PATH');
  const done = db.prepare(\"SELECT COUNT(*) as c FROM raw_events WHERE status='done'\").get().c;
  const total = db.prepare('SELECT COUNT(*) as c FROM raw_events').get().c;
  const dead = db.prepare(\"SELECT COUNT(*) as c FROM raw_events WHERE status='dead'\").get().c;
  db.close();
  console.log('L1_DONE=' + done + ' L1_TOTAL=' + total + ' L1_DEAD=' + dead);
" 2>/dev/null)"

if [ "$L1_DONE" = "$L1_TOTAL" ]; then
  pass "L1 Plumbing        ($L1_DONE/$L1_TOTAL events done)"
else
  fail "L1 Plumbing        ($L1_DONE/$L1_TOTAL done, $L1_DEAD dead)"
fi

# L2: rules-agent — new .md file in rules/
if [ -n "$NEW_RULES" ]; then
  RULES_NAMES=$(echo "$NEW_RULES" | xargs -I{} basename {} | tr '\n' ', ' | sed 's/,$//')
  pass "L2 rules-agent     (new: $RULES_NAMES)"
else
  fail "L2 rules-agent     (no new files in .claude/rules/)"
fi

# L2: offer-agent — new .md file in offers/
if [ -n "$NEW_OFFERS" ]; then
  OFFER_NAMES=$(echo "$NEW_OFFERS" | xargs -I{} basename {} | tr '\n' ', ' | sed 's/,$//')
  pass "L2 offer-agent     (new: $OFFER_NAMES)"
else
  fail "L2 offer-agent     (no new files in .claude-auto-context/offers/)"
fi

# L2: claudemd-agent — CLAUDE.md changed
if [ "$CLAUDEMD_MD5_BEFORE" != "$CLAUDEMD_MD5_AFTER" ]; then
  LINES_ADDED=$(diff "$CLAUDEMD.bak" "$CLAUDEMD" 2>/dev/null | grep -c '^>' || echo 0)
  pass "L2 claudemd-agent  (CLAUDE.md +${LINES_ADDED} lines)"
else
  fail "L2 claudemd-agent  (CLAUDE.md unchanged)"
fi

echo -e "${BOLD}──────────────────────────────────────────${NC}"

# L3: rules content checks (only if L2 passed)
if [ -n "$NEW_RULES" ]; then
  # L3: YAML frontmatter
  HAS_FRONTMATTER=false
  for f in $NEW_RULES; do
    if head -1 "$f" | grep -q '^---'; then
      HAS_FRONTMATTER=true
      break
    fi
  done
  if $HAS_FRONTMATTER; then
    pass "L3 rules format    (YAML frontmatter found)"
  else
    fail "L3 rules format    (no YAML frontmatter)"
  fi

  # L3: content keywords
  RULES_CONTENT=$(cat $NEW_RULES 2>/dev/null)
  if echo "$RULES_CONTENT" | grep -qi 'AppError\|data.*error.*meta\|Service.layer\|service.*only'; then
    FOUND_KW=$(echo "$RULES_CONTENT" | grep -oi 'AppError\|data.*error.*meta\|Service.layer' | head -1)
    pass "L3 rules content   (\"$FOUND_KW\" found)"
  else
    fail "L3 rules content   (none of: AppError, {data,error,meta}, Service layer)"
  fi
else
  fail "L3 rules format    (skipped — no rules files)"
  fail "L3 rules content   (skipped — no rules files)"
fi

# L3: offer content checks (only if L2 passed)
if [ -n "$NEW_OFFERS" ]; then
  OFFER_CONTENT=$(cat $NEW_OFFERS 2>/dev/null)

  # L3: bare "pending" line
  if echo "$OFFER_CONTENT" | grep -q '^pending$'; then
    pass "L3 offer format    (bare \"pending\" line found)"
  else
    fail "L3 offer format    (no bare \"pending\" line)"
  fi

  # L3: "utils" keyword
  if echo "$OFFER_CONTENT" | grep -qi 'utils'; then
    pass "L3 offer content   (\"utils\" found)"
  else
    fail "L3 offer content   (\"utils\" not found)"
  fi
else
  fail "L3 offer format    (skipped — no offer files)"
  fail "L3 offer content   (skipped — no offer files)"
fi

# L3: claudemd content checks (only if L2 passed)
if [ "$CLAUDEMD_MD5_BEFORE" != "$CLAUDEMD_MD5_AFTER" ]; then
  CLAUDEMD_DIFF=$(diff "$CLAUDEMD.bak" "$CLAUDEMD" | grep '^>' || true)
  ADDED_LINES=$(echo "$CLAUDEMD_DIFF" | grep -c '.' || echo 0)

  # L3: line count
  if [ "$ADDED_LINES" -le 10 ]; then
    pass "L3 claudemd lines  (${ADDED_LINES} lines added, ≤10)"
  else
    fail "L3 claudemd lines  (${ADDED_LINES} lines added, >10)"
  fi

  # L3: content keywords
  if echo "$CLAUDEMD_DIFF" | grep -qi 'docker\|bun.*watch\|test'; then
    FOUND_KW=$(echo "$CLAUDEMD_DIFF" | grep -oi 'docker\|bun.*watch\|test' | head -1)
    pass "L3 claudemd content (\"$FOUND_KW\" found)"
  else
    fail "L3 claudemd content (none of: docker, bun --watch, test)"
  fi
else
  fail "L3 claudemd lines  (skipped — CLAUDE.md unchanged)"
  fail "L3 claudemd content (skipped — CLAUDE.md unchanged)"
fi

# ── Final Report ───────────────────────────────────────────────

TOTAL=$((PASS_COUNT + FAIL_COUNT))
echo -e "${BOLD}──────────────────────────────────────────${NC}"
if [ $FAIL_COUNT -eq 0 ]; then
  echo -e "  ${GREEN}${BOLD}Result: $PASS_COUNT/$TOTAL PASSED${NC}"
else
  echo -e "  ${RED}${BOLD}Result: $PASS_COUNT/$TOTAL PASSED, $FAIL_COUNT FAILED${NC}"
fi
echo -e "${BOLD}══════════════════════════════════════════${NC}"

# Show worker log excerpt if any failures
if [ $FAIL_COUNT -gt 0 ] && [ -f "$DB_DIR/worker.log" ]; then
  echo -e "\n${YELLOW}Worker log (last 20 lines):${NC}"
  tail -20 "$DB_DIR/worker.log" 2>/dev/null || true
fi

exit $FAIL_COUNT
