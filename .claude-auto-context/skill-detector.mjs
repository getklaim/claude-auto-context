#!/usr/bin/env bun
// skill-detector.mjs — Deterministic skill pattern detection
// Runs after collectObservations() in processBatch(). No LLM calls.
// Writes candidates to observations table with agent_source='skill-agent'.

// --- Tool Classification Constants (SDET-03) ---

const EXPLORATION_TOOLS = new Set(['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'LS']);
const MUTATION_TOOLS = new Set(['Write', 'Edit', 'Bash', 'MultiEdit']);
const WEB_TOOLS = new Set(['WebSearch', 'WebFetch']);

// --- SINT-03: Observations Write/Read ---

function writeSkillObservation(db, patternKey, sessionId, evidence) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO observations (pattern_key, session_id, evidence, agent_source)
    VALUES (?, ?, ?, 'skill-agent')
  `);
  stmt.run(patternKey, sessionId, JSON.stringify(evidence));
}

function readExistingSkillObservations(db) {
  return db.prepare(`
    SELECT pattern_key, session_id, evidence
    FROM observations
    WHERE pattern_key LIKE 'skill:%'
      AND agent_source = 'skill-agent'
  `).all();
}

// --- Session Fingerprint Extraction ---

function extractSessionFingerprints(events) {
  const bySession = new Map();
  for (const e of events) {
    if (!bySession.has(e.session_id)) {
      bySession.set(e.session_id, {
        sessionId: e.session_id,
        prompts: [],
        toolSeq: [],
        toolEvents: [],
      });
    }
    const s = bySession.get(e.session_id);
    try {
      const p = JSON.parse(e.payload);
      if (e.hook_type === 'UserPromptSubmit' && p.prompt) {
        s.prompts.push(p.prompt);
      } else if (e.hook_type === 'PostToolUse' && e.tool_name) {
        s.toolSeq.push(e.tool_name);
        s.toolEvents.push(e);
      }
    } catch {
      // skip malformed payload
    }
  }
  return [...bySession.values()];
}

// --- SDET-06: Self-Referential Filters ---

function isPluginInternalEvent(event) {
  try {
    const payload = JSON.parse(event.payload);
    const filePath = payload?.tool_input?.file_path || payload?.tool_input?.path || '';
    return (
      filePath.startsWith('.claude/') ||
      filePath.startsWith('.claude-auto-context/') ||
      filePath.includes('/.claude/') ||
      filePath.includes('/.claude-auto-context/')
    );
  } catch {
    return false;
  }
}

function isSkillInvocationSession(events) {
  return events
    .filter(e => e.hook_type === 'UserPromptSubmit')
    .some(e => {
      try {
        const p = JSON.parse(e.payload);
        return p.prompt && (
          p.prompt.trim().startsWith('/') ||
          /^\/(cac-|skill-)/i.test(p.prompt.trim())
        );
      } catch {
        return false;
      }
    });
}

function isTaskDelegationSession(events) {
  const taskTools = new Set(['Task', 'TaskCreate', 'TaskUpdate', 'TaskGet', 'Agent']);
  const toolEvents = events.filter(e => e.hook_type === 'PostToolUse');
  if (toolEvents.length === 0) return false;
  const taskCount = toolEvents.filter(e => taskTools.has(e.tool_name)).length;
  return taskCount >= 2;
}

function filterEvents(events) {
  // Step 1: Remove individual events where isPluginInternalEvent() === true
  const nonInternal = events.filter(e => !isPluginInternalEvent(e));

  // Step 2: Group remaining by session_id
  const bySession = new Map();
  for (const e of nonInternal) {
    if (!bySession.has(e.session_id)) bySession.set(e.session_id, []);
    bySession.get(e.session_id).push(e);
  }

  // Step 3: Remove entire sessions where isSkillInvocationSession() === true
  // Step 4: Remove entire sessions where isTaskDelegationSession() === true
  const remaining = [];
  for (const [, sessionEvents] of bySession) {
    if (isSkillInvocationSession(sessionEvents)) continue;
    if (isTaskDelegationSession(sessionEvents)) continue;
    remaining.push(...sessionEvents);
  }

  // Step 5: Return flat array of remaining events
  return remaining;
}

// --- SDET-03: Negative Heuristic Filters ---

function isBashError(toolResponse) {
  if (!toolResponse) return false;
  const r = typeof toolResponse === 'string' ? toolResponse : JSON.stringify(toolResponse);
  return /exit code [1-9]|Error:|error:|FAILED|command not found|No such file/.test(r);
}

function isPureExploration(toolSeq) {
  return toolSeq.length > 0 && !toolSeq.some(t => MUTATION_TOOLS.has(t));
}

function isDebuggingSpiral(events) {
  const bashErrors = events
    .filter(e => e.hook_type === 'PostToolUse' && e.tool_name === 'Bash')
    .filter(e => {
      try {
        const p = JSON.parse(e.payload);
        return isBashError(p.tool_response);
      } catch { return false; }
    });
  return bashErrors.length >= 5;
}

function isSingleFileEdit(toolSeq, events) {
  if (toolSeq.length > 4) return false;
  const writeEdits = toolSeq.filter(t => t === 'Write' || t === 'Edit');
  return writeEdits.length === 1;
}

function isWebResearchOnly(toolSeq) {
  if (toolSeq.length === 0) return false;
  const webCount = toolSeq.filter(t => WEB_TOOLS.has(t)).length;
  const hasMutation = toolSeq.some(t => t === 'Write' || t === 'Edit');
  return (webCount / toolSeq.length > 0.5) && !hasMutation;
}

function isSingleHookPattern(toolSeq) {
  return toolSeq.length <= 2 && toolSeq.filter(t => t === 'Bash').length === 1;
}

function applyNegativeHeuristics(fingerprint, events) {
  const { toolSeq } = fingerprint;
  if (isPureExploration(toolSeq)) return { passed: false, reason: 'pure-exploration' };
  if (isDebuggingSpiral(events)) return { passed: false, reason: 'debugging-spiral' };
  if (isSingleFileEdit(toolSeq, events)) return { passed: false, reason: 'single-file-edit' };
  if (isWebResearchOnly(toolSeq)) return { passed: false, reason: 'web-research-only' };
  if (isSingleHookPattern(toolSeq)) return { passed: false, reason: 'single-hook-pattern' };
  return { passed: true, reason: null };
}

// --- Entry Point (stub — wired in Plan 03) ---

function runSkillDetector(events, db) {
  // Pre-filter self-referential and internal events
  const filtered = filterEvents(events);
  // Extract per-session fingerprints (prompts + toolSeq) — used in Plan 02+03
  const fingerprints = extractSessionFingerprints(filtered);

  // Group events by session_id for per-session heuristic checks
  const bySession = new Map();
  for (const e of filtered) {
    if (!bySession.has(e.session_id)) bySession.set(e.session_id, []);
    bySession.get(e.session_id).push(e);
  }

  let discarded = 0;
  const passing = [];
  for (const fp of fingerprints) {
    const sessionEvents = bySession.get(fp.sessionId) || [];
    const result = applyNegativeHeuristics(fp, sessionEvents);
    if (!result.passed) {
      discarded++;
    } else {
      passing.push(fp);
    }
  }

  // Similarity matching and scoring wired in Plan 02+03
  void passing;
  return { candidates: 0, observations_written: 0, discarded };
}

export { runSkillDetector };
