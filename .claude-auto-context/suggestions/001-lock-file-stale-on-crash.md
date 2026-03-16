# 001 — Lock File Not Cleaned Up on Worker Crash or SIGKILL

## Summary

The worker uses a PID-based lock file at `.claude-auto-context/worker.lock` to
enforce single-instance execution. When the worker exits via `SIGTERM` or
`SIGINT` it correctly removes the lock. However, if the process is killed with
`SIGKILL`, crashes before the `finally` block runs, or is terminated by the OS
(OOM kill, hard reboot), the lock file is left behind containing a stale PID.

The launcher script (`scripts/worker-launcher.sh`) does perform a stale-lock
check: it reads the PID and calls `kill -0` to verify liveness. If the process
is dead the stale lock is removed and a new worker starts normally. This means
the guard works — but only when the launcher is invoked again. In the window
between a crash and the next launcher invocation (triggered by the next hook
event), no new worker can start because the hook scripts exit early when they
see the lock file and do not yet call the launcher.

Additionally, the log contains direct evidence of a second, more immediate
failure mode: two worker instances started within 20 seconds of each other
(pids 23926 and 25094, 2026-03-03T01:09:50 and 01:10:44) and the earlier
instance left the lock removed but left 5 events in `processing` state. The
second instance then had to self-heal those events on its first poll, wasting
one full `POLL_INTERVAL_MS` cycle (30 s) before re-claiming them.

## Evidence from Session Data

### Incident 1 — CLAUDECODE env var blocks processBatch (pre-fix)

```
[2026-03-03T01:09:00.090Z] processBatch failed: Claude Code process exited with code 1
[2026-03-03T01:09:00.141Z] processBatch failed: Claude Code process exited with code 1
[2026-03-03T01:09:00.195Z] processBatch failed: Claude Code process exited with code 1
[2026-03-03T01:09:00.196Z] self-heal: 8 events moved to dead
[2026-03-03T01:09:14.920Z] worker stopped, lock removed
```

3 consecutive `processBatch failed` calls in under 200 ms caused the self-heal
threshold to be reached immediately (retry_count > MAX_RETRIES=3), promoting
8 events to `dead` status. The lock was removed cleanly here because the worker
exited via the `finally` block after exhausting retries in `rejectBatch`.

### Incident 2 — Rapid sequential starts, stale processing state

```
[2026-03-03T01:09:50.817Z] worker started (pid=23926)
[2026-03-03T01:09:50.819Z] claimed 5 events
[2026-03-03T01:10:10.779Z] worker stopped, lock removed      ← pid 23926 exits after ~20 s
[2026-03-03T01:10:44.535Z] worker started (pid=25094)
[2026-03-03T01:10:44.537Z] claimed 9 events
[2026-03-03T01:11:06.636Z] self-heal: 5 events recovered     ← 30 s later
```

pid 23926 exited (lock removed) but the 5 events it had claimed remained in
`processing` state. pid 25094 claimed a fresh batch of 9 events on startup,
then after one full `POLL_INTERVAL_MS` sleep (30 s) its next `claimBatch` call
triggered `selfHeal`, which recovered the 5 orphaned events. Total extra
latency: ~30 s for those 5 events.

### Incident 3 — Current state: lock held, no termination record

```
[2026-03-03T01:10:44.535Z] worker started (pid=25094)
...
[2026-03-03T01:11:06.639Z] confirmed event #819
(log ends — no "worker stopped" entry)
```

`.claude-auto-context/worker.lock` currently contains `25094`. The log has no
shutdown record for this pid. This is either because the worker is still
running and polling (normal), or it was killed hard and left a stale lock. The
second test run described in the session — where `tail` returned empty
stdout/stderr — aligns with the stale-lock scenario: if pid 23926's lock was
not yet cleaned when the second launcher invocation ran, the launcher would
have called `kill -0 23926`, found it alive (it was still in its 20 s window),
and exited 0 without starting a new worker.

## Structural Issues

### Issue A — Lock is removed in `finally`, not in signal handlers before exit

```js
// worker.mjs lines 198-201
function cleanup() {
  try { unlinkSync(lockPath); } catch {}
  log('worker stopped, lock removed');
}

process.on('SIGTERM', () => { cleanup(); process.exit(0); });
process.on('SIGINT',  () => { cleanup(); process.exit(0); });
```

`SIGKILL` cannot be caught. Any OOM kill, `kill -9`, or hard machine
shutdown leaves the lock in place. The launcher's `kill -0` guard handles
this on the next invocation, but there is a silent window where events queue
up unprocessed.

### Issue B — Orphaned `processing` events on any early exit

When the worker exits (cleanly or otherwise) while holding a claimed batch,
those events remain in `processing` status. The self-heal query only runs
inside `claimBatch`, which is called at the top of each poll loop. If
`STALE_THRESHOLD_S` (currently 60 s) has not elapsed, `selfHeal` will not
recover them. This means events can be blocked for up to 60 s after a worker
restart, plus one additional `POLL_INTERVAL_MS` (30 s) sleep cycle if the
batch was empty on the first poll — a worst-case stall of ~90 s.

### Issue C — No startup check that clears own stale `processing` rows

When a new worker starts it writes its PID to the lock file but does not
immediately reset any `processing` rows from the previous (now-dead) worker.
The first `claimBatch` call will call `selfHeal`, but only after
`STALE_THRESHOLD_S` has elapsed since `claimed_at`. Events claimed seconds
before the crash can therefore block for the full 60 s threshold.

### Issue D — Dual env-var cleanup is undocumented

`unset CLAUDECODE` appears in `scripts/worker-launcher.sh` (line 31) and
`delete process.env.CLAUDECODE` appears in `.claude-auto-context/worker.mjs`
(line 14). This is correct defensive layering: if someone invokes the worker
directly without the launcher the in-process delete still applies. However,
this is not documented anywhere, so a future maintainer may remove one copy
believing it redundant, breaking the other invocation path.

## Proposed Remediations

1. **On startup, immediately self-heal without waiting for `STALE_THRESHOLD_S`.**
   After writing the lock file, run a targeted SQL update:
   ```sql
   UPDATE raw_events SET status='pending', claimed_at=NULL, retry_count=retry_count+1
   WHERE status='processing';
   ```
   This ensures the new worker inherits a clean queue regardless of how the
   previous instance exited.

2. **Reduce or parameterise `STALE_THRESHOLD_S`** from 60 s to match realistic
   `processBatch` durations. The agent timeout is `AGENT_TIMEOUT_MS = 180 s`,
   so 60 s is actually too short for in-flight batches. Consider setting
   `STALE_THRESHOLD_S = 200` (just above `AGENT_TIMEOUT_MS / 1000`) and
   pairing it with the startup-reset from (1) so legitimate in-flight work is
   not prematurely recovered.

3. **Add a SIGKILL note and lock-staleness documentation** to `worker.mjs` and
   `worker-launcher.sh` explaining the two-layer env-var strategy and the
   `kill -0` guard's role in stale-lock recovery.

4. **Log the stale-lock detection path** in `worker-launcher.sh`:
   ```bash
   echo "[$(date -u +%FT%TZ)] stale lock removed (pid=$PID)" >> "$LOG_FILE"
   ```
   Currently the launcher removes a stale lock silently, making post-mortem
   analysis harder (as seen in the second test run where the log showed no
   evidence of why the new worker did or did not start).

## Impact

- Severity: Medium
- Frequency: Reproducible on any hard kill or crash during `processBatch`
- Events at risk: All events in `processing` state at crash time, delayed up
  to `STALE_THRESHOLD_S` + `POLL_INTERVAL_MS` = 90 s at current settings
- Data loss risk: None — events return to `pending` via self-heal; no event
  is permanently lost unless `retry_count > MAX_RETRIES`

## Sessions Referenced

| Timestamp (UTC) | PIDs | Events | Observation |
|---|---|---|---|
| 2026-03-03T01:09:00 | (pre-fix worker) | #806-813 (8 events) | 3x processBatch fail, events moved to dead |
| 2026-03-03T01:09:50 | 23926 | #814-818 (5 events) | Worker exited ~20 s after start; 5 events left in processing |
| 2026-03-03T01:10:44 | 25094 | #818-822 (9 events) | Self-heal recovered 5 events 30 s after startup |
| 2026-03-03T01:11:06 | 25094 | #815-819 | Lock still held; no shutdown record in log |
