---
name: run-worker
description: "Worker 수동 실행 및 상태 확인. USE WHEN 워커 테스트, worker 실행, 워커 상태."
disable-model-invocation: true
---

# Run Worker

Auto Context 워커를 수동 실행하거나 상태를 확인한다.

## Current Status

- Lock file: !`LOCK=".claude-auto-context/worker.lock"; if [ -f "$LOCK" ]; then PID=$(cat "$LOCK"); if kill -0 "$PID" 2>/dev/null; then echo "RUNNING (pid=$PID)"; else echo "STALE LOCK (pid=$PID, not alive)"; fi; else echo "NOT RUNNING"; fi`
- Pending events: !`sqlite3 .claude-auto-context/db/claude-auto-context.db "SELECT count(*) FROM raw_events WHERE status='pending'" 2>/dev/null || echo "DB not found"`
- Recent log:

!`tail -5 .claude-auto-context/db/worker.log 2>/dev/null || echo "No log file"`

## Procedure

Arguments: $ARGUMENTS

1. **`status`** — 위 Current Status 섹션 정보를 보여주고 끝
2. **`logs`** — `tail -30 .claude-auto-context/db/worker.log` 실행하여 최근 로그 출력
3. **`force`** — 강제 재시작:
   a. Lock file에서 PID 읽어서 `kill $PID` 실행
   b. Lock file 삭제: `rm -f .claude-auto-context/worker.lock`
   c. `scripts/worker-launcher.sh` 실행 (현재 프로젝트 디렉토리를 인자로 전달)
   d. 2초 후 lock file 확인하여 시작 여부 보고
4. **인자 없음** — 스마트 실행:
   a. 워커가 이미 RUNNING이면 상태만 보여줌
   b. NOT RUNNING 또는 STALE LOCK이면 `scripts/worker-launcher.sh` 실행 후 상태 확인

## Launch Command

워커 실행 시 반드시 이 명령을 사용:

```bash
./scripts/worker-launcher.sh "$(pwd)"
```

직접 `bun .claude-auto-context/worker.mjs`를 실행하지 말 것 — launcher가 lock file, 환경변수(CLAUDECODE unset), 로그 리다이렉트를 처리한다.
