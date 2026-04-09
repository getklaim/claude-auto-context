#!/usr/bin/env bash
# Stop Hook
# Skip Stop event storage (collector handles this).
# Launch worker if ≥100 pending events.

source "$(dirname "$0")/common.sh"

BATCH_THRESHOLD=300
TIME_THRESHOLD=100
AGE_THRESHOLD_SEC=3600  # 1 hour

# Stop events are no longer stored — collector.mjs exits early for Stop hook.
# Launch worker if: pending >= 300 OR (pending >= 100 AND oldest pending > 1hr)

DB_PATH="$PROJECT_DIR/.claude-auto-context/db/claude-auto-context.db"
if [ -f "$DB_PATH" ]; then
  # Resolve bun command: native or npx fallback
  if command -v bun &>/dev/null; then
    _BUN="bun"
  elif command -v npx &>/dev/null; then
    _BUN="npx -y bun"
  else
    SHOULD_LAUNCH=0
  fi
  if [ -z "${SHOULD_LAUNCH:-}" ]; then
    SHOULD_LAUNCH=$($_BUN -e "
import{Database}from'bun:sqlite';
try{
  const d=new Database('$DB_PATH',{readonly:true});
  const{cnt}=d.prepare('SELECT count(*)as cnt FROM raw_events WHERE status=?').get('pending');
  if(cnt>=$BATCH_THRESHOLD){console.log(1)}
  else if(cnt>=$TIME_THRESHOLD){
    const r=d.prepare(\"SELECT MIN(timestamp)as oldest FROM raw_events WHERE status='pending'\").get();
    const age=(Date.now()-new Date(r.oldest+'Z').getTime())/1000;
    console.log(age>=$AGE_THRESHOLD_SEC?1:0);
  }else{console.log(0)}
  d.close()
}catch{console.log(0)}
" 2>/dev/null || echo "0")
  fi
  if [ "$SHOULD_LAUNCH" -eq 1 ]; then
    "$PLUGIN_ROOT/scripts/worker-launcher.sh" "$PROJECT_DIR" &
  fi
fi

log "Session stopped"

exit 0
