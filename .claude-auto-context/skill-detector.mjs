#!/usr/bin/env bun
// skill-detector.mjs — Deterministic skill pattern detection
// Runs after collectObservations() in processBatch(). No LLM calls.
// Writes candidates to observations table with agent_source='skill-agent'.

import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

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

// --- SDET-01: Prompt Normalization and Jaccard Similarity ---

function normalizePrompt(text) {
  return text
    .toLowerCase()
    .replace(/\S+\/\S+\.\w+/g, '')                           // strip file paths (e.g., src/utils.ts)
    .replace(/하고|그리고|후에|다음에|그다음/g, ' ')              // strip Korean connectors
    .replace(/\bthen\b|\bafter that\b|\band then\b|\bfinally\b/g, ' ')  // strip English connectors
    .replace(/[^a-z0-9\uAC00-\uD7A3\u3131-\u3163\s]/g, ' ')  // keep alphanumeric + Hangul syllables + jamo
    .replace(/\s+/g, ' ')
    .trim();
}

function wordSet(text) {
  return new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\uAC00-\uD7A3\u3131-\u3163\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1)
  );
}

function jaccardSimilarity(a, b) {
  const sa = wordSet(normalizePrompt(a));
  const sb = wordSet(normalizePrompt(b));
  if (sa.size === 0 && sb.size === 0) return 1;
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter++;
  return inter / (sa.size + sb.size - inter);
}

// --- SDET-01: LCS Algorithm for Tool Sequences ---

function lcs(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

function lcsSequence(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  // Backtrack to find actual sequence
  const result = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]);
      i--; j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return result;
}

function workflowSimilarity(seqA, seqB) {
  if (seqA.length === 0 && seqB.length === 0) return 1;
  if (seqA.length === 0 || seqB.length === 0) return 0;
  const lcsLen = lcs(seqA, seqB);
  const avg = (seqA.length + seqB.length) / 2;
  return lcsLen / avg;
}

function groupSessionsByPattern(fingerprints, existingObservations) {
  // Each group: { patternKey, sessions: [{sessionId, prompts, toolSeq}], lcsSeq, bestPrompt }
  const groups = [];

  // Load existing observations into comparable format
  const priorSessions = existingObservations.map(obs => {
    const ev = JSON.parse(obs.evidence);
    return {
      sessionId: obs.session_id,
      patternKey: obs.pattern_key,
      prompts: [ev.prompt_fingerprint || ''],
      toolSeq: ev.tool_sequence || [],
    };
  });

  const allSessions = [...fingerprints, ...priorSessions];

  // Union-Find style grouping: compare all pairs
  const assigned = new Set();
  for (let i = 0; i < allSessions.length; i++) {
    if (assigned.has(i)) continue;
    const group = { sessions: [allSessions[i]], lcsSeq: allSessions[i].toolSeq };

    for (let j = i + 1; j < allSessions.length; j++) {
      if (assigned.has(j)) continue;
      const promptA = allSessions[i].prompts.join(' ');
      const promptB = allSessions[j].prompts.join(' ');
      const jaccard = jaccardSimilarity(promptA, promptB);
      const lcsLen = lcs(allSessions[i].toolSeq, allSessions[j].toolSeq);

      if (jaccard > 0.5 && lcsLen >= 5) {
        group.sessions.push(allSessions[j]);
        group.lcsSeq = lcsSequence(group.lcsSeq, allSessions[j].toolSeq);
        assigned.add(j);
      }
    }

    if (group.sessions.length >= 1) {
      // Generate pattern key from LCS
      const seqKey = group.lcsSeq.join('-').slice(0, 60);
      group.patternKey = `skill:seq:${seqKey}`;
      group.bestPrompt = allSessions[i].prompts.join(' ');
      groups.push(group);
    }
    assigned.add(i);
  }

  return groups;
}

// --- SDET-02: Compound Action Parsing ---

const KO_ACTIONS = {
  '수정': 'edit', '고쳐': 'edit', '편집': 'edit',
  '커밋': 'commit', '올려': 'commit',
  '푸시': 'push', '푸쉬': 'push',
  '테스트': 'test', '빌드': 'build',
  '배포': 'deploy', '릴리스': 'release',
  '확인': 'check', '검토': 'review',
  '생성': 'create', '만들': 'create',
  '삭제': 'delete', '제거': 'remove',
  '린트': 'lint', '포맷': 'format',
};

function extractKoreanVerbs(text) {
  const verbs = [];
  const seen = new Set();
  for (const [ko, en] of Object.entries(KO_ACTIONS)) {
    if (text.includes(ko) && !seen.has(en)) {
      verbs.push(en);
      seen.add(en);
    }
  }
  return verbs;
}

const EN_ACTIONS = ['fix', 'edit', 'update', 'commit', 'push', 'test', 'build',
  'deploy', 'release', 'check', 'review', 'create', 'delete', 'run', 'lint', 'format',
  'install', 'remove', 'refactor', 'migrate'];

function extractEnglishVerbs(text) {
  const segments = text.toLowerCase().split(/\bthen\b|,\s*and\b|,\s|\band\b|\bafter that\b/);
  return segments
    .map(s => EN_ACTIONS.find(v => s.trim().startsWith(v)))
    .filter(Boolean);
}

function extractCompoundVerbs(text) {
  const ko = extractKoreanVerbs(text);
  const en = extractEnglishVerbs(text);
  // Return whichever found more verbs (mixed prompts default to the richer extraction)
  return ko.length >= en.length ? ko : en;
}

function isCompoundAction(text, toolSeqLength) {
  const verbs = extractCompoundVerbs(text);
  return verbs.length >= 2 && toolSeqLength >= 5;
}

// --- SDET-04: Scoring Formula ---

function countParams(lcsSteps, sessionToolInputs) {
  let params = 0;
  for (let i = 0; i < lcsSteps.length; i++) {
    const values = sessionToolInputs.map(s => JSON.stringify(s[i]?.tool_input || {}));
    const unique = new Set(values);
    if (unique.size > 1) params++;
  }
  return params;
}

function hasMutation(toolSeq) {
  return toolSeq.some(t => MUTATION_TOOLS.has(t)) ? 1 : 0;
}

function checkExistingCoverage(promptText, projectRoot) {
  const registryPath = resolve(projectRoot, '.claude-auto-context', 'skills-registry.json');
  if (!existsSync(registryPath)) return 0;
  try {
    const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
    if (!Array.isArray(registry)) return 0;
    for (const skill of registry) {
      const desc = skill.description || skill.name || '';
      if (jaccardSimilarity(promptText, desc) > 0.6) return 1;
    }
  } catch {}
  return 0;
}

function computeScore(factors) {
  const {
    session_count,
    step_count,
    param_count = 0,
    has_mutation = 0,
    existing_coverage = 0,
  } = factors;

  return (
    session_count * 3.0 +
    step_count * 0.5 +
    param_count * 1.0 +
    has_mutation * 2.0 -
    existing_coverage * 10.0
  );
}

function scoreDecision(score, sessionCount, stepCount) {
  // Hard gate: step_count < 5 is always discarded regardless of score
  if (stepCount < 5) return 'discard';
  // Generate threshold
  if (score >= 10.0 && sessionCount >= 3) return 'generate';
  // Observe threshold
  if (score >= 5.0) return 'observe';
  // Below all thresholds
  return 'discard';
}

// --- SDET-05: Classification Decision Tree ---

function hasNLTrigger(events) {
  const sorted = [...events].sort((a, b) => a.id - b.id);
  const firstPrompt = sorted.findIndex(e => e.hook_type === 'UserPromptSubmit');
  const firstTool = sorted.findIndex(e => e.hook_type === 'PostToolUse');
  // NL trigger exists if a prompt comes before (or with) tool activity
  return firstPrompt >= 0 && (firstTool < 0 || firstPrompt <= firstTool);
}

function hasDecisionPoints(sessions) {
  if (sessions.length < 2) return false;
  for (let i = 0; i < sessions.length - 1; i++) {
    const seqA = sessions[i].toolSeq;
    const seqB = sessions[i + 1].toolSeq;
    const lcsLen = lcs(seqA, seqB);
    const maxLen = Math.max(seqA.length, seqB.length);
    if (maxLen > 0 && (lcsLen / maxLen) < 0.7) {
      return true; // sequences diverge — decision branches exist
    }
  }
  return false;
}

function classifyPattern(fingerprint, sessions, events) {
  const { toolSeq } = fingerprint;
  const stepCount = toolSeq.length;

  // Step 1: Too few steps — not a skill
  if (stepCount < 5) {
    return { classification: 'rules-or-hooks', reason: 'step_count < 5' };
  }

  // Step 2: No NL trigger — automated action, delegate to hooks
  if (!hasNLTrigger(events)) {
    return { classification: 'hooks-agent', reason: 'no NL trigger' };
  }

  // Step 3: Single Bash command pattern
  if (toolSeq.length <= 2 && toolSeq.includes('Bash')) {
    return { classification: 'hooks-agent', reason: 'single Bash pattern' };
  }

  // Step 4: No decision points AND step_count < 8 — could be a hook chain
  if (!hasDecisionPoints(sessions) && stepCount < 8) {
    return { classification: 'hooks-agent', reason: 'linear chain, step_count < 8' };
  }

  // Step 5: Full skill candidate
  const mutation = hasMutation(toolSeq);
  if (mutation) {
    return { classification: 'skill', reason: 'NL trigger + mutation + 5+ steps' };
  }

  // Step 6: Ambiguous — discard (false-negative bias)
  return { classification: 'discard', reason: 'ambiguous: no mutation despite 5+ steps' };
}

function checkCrossAgentDuplicate(db, patternKey, sessionId) {
  const row = db.prepare(`
    SELECT COUNT(*) as cnt FROM observations
    WHERE pattern_key = ?
    AND agent_source IN ('rules-agent', 'hooks-agent')
    AND session_id = ?
  `).get(patternKey, sessionId);
  return row && row.cnt > 0;
}

// --- Entry Point ---

export function runSkillDetector(events, db) {
  const result = { candidates: 0, observations_written: 0, discarded: 0 };

  // Step 1: Filter out plugin-internal events and self-referential sessions
  const filtered = filterEvents(events);
  if (filtered.length === 0) return result;

  // Step 2: Extract session fingerprints
  const fingerprints = extractSessionFingerprints(filtered);
  if (fingerprints.length === 0) return result;

  // Step 3: Apply negative heuristics per session
  const viable = [];
  for (const fp of fingerprints) {
    const sessionEvents = filtered.filter(e => e.session_id === fp.sessionId);
    const heuristic = applyNegativeHeuristics(fp, sessionEvents);
    if (heuristic.passed) {
      viable.push(fp);
    } else {
      result.discarded++;
    }
  }
  if (viable.length === 0) return result;

  // Step 4: Load existing skill observations for cross-session matching
  const existingObs = readExistingSkillObservations(db);

  // Step 5: Group sessions by pattern similarity
  const groups = groupSessionsByPattern(viable, existingObs);

  // Step 6: Score and classify each group
  const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  for (const group of groups) {
    const lcsSeq = group.lcsSeq;
    const stepCount = lcsSeq.length;
    const sessionCount = group.sessions.length;

    // Classification
    const firstSession = group.sessions[0];
    const firstSessionEvents = filtered.filter(e => e.session_id === firstSession.sessionId);
    const classification = classifyPattern(
      { toolSeq: lcsSeq },
      group.sessions,
      firstSessionEvents
    );

    if (classification.classification !== 'skill') {
      result.discarded++;
      continue;
    }

    result.candidates++;

    // Scoring
    const mutationFlag = hasMutation(lcsSeq);
    const coverage = checkExistingCoverage(group.bestPrompt, projectRoot);
    const score = computeScore({
      session_count: sessionCount,
      step_count: stepCount,
      param_count: 0, // param_count computed with full tool_input in future enhancement
      has_mutation: mutationFlag,
      existing_coverage: coverage,
    });

    const decision = scoreDecision(score, sessionCount, stepCount);
    if (decision === 'discard') {
      result.discarded++;
      continue;
    }

    // Compound verb extraction
    const compoundVerbs = extractCompoundVerbs(group.bestPrompt);
    const patternKey = compoundVerbs.length >= 2
      ? `skill:verb-chain:${compoundVerbs.join('-')}`
      : group.patternKey;

    // Write observation for each new session in this group
    for (const session of group.sessions) {
      if (checkCrossAgentDuplicate(db, patternKey, session.sessionId)) continue;

      const evidence = {
        prompt_fingerprint: normalizePrompt(session.prompts.join(' ')),
        tool_sequence: lcsSeq,
        step_count: stepCount,
        param_count: 0,
        score: score,
        decision: decision,
        session_count_at_time: sessionCount,
        workflow_similarity: group.sessions.length >= 2
          ? workflowSimilarity(group.sessions[0].toolSeq, session.toolSeq)
          : 1.0,
        compound_verbs: compoundVerbs,
        classification: classification.classification,
        classification_reason: classification.reason,
      };

      writeSkillObservation(db, patternKey, session.sessionId, evidence);
      result.observations_written++;
    }
  }

  return result;
}
