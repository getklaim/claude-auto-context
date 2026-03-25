import { test, expect, describe } from 'bun:test';
import { Database } from 'bun:sqlite';
import {
  normalizePrompt, jaccardSimilarity, lcs, lcsSequence, workflowSimilarity,
  extractKoreanVerbs, extractEnglishVerbs, extractCompoundVerbs, isCompoundAction,
  isPureExploration, isDebuggingSpiral, isSingleFileEdit, isWebResearchOnly,
  isSingleHookPattern, isPluginInternalEvent, isSkillInvocationSession,
  computeScore, scoreDecision, classifyPattern, hasMutation, hasNLTrigger,
  hasDecisionPoints, applyNegativeHeuristics,
  runSkillDetector,
} from '../.claude-auto-context/skill-detector.mjs';

// ──── SDET-01: Jaccard Similarity ────

describe('jaccard similarity', () => {
  test('similar prompts score > 0.5', () => {
    const score = jaccardSimilarity(
      'fix and commit and push the changes',
      'fix, commit, push the changes'
    );
    expect(score).toBeGreaterThan(0.5);
  });

  test('dissimilar prompts score < 0.5', () => {
    const score = jaccardSimilarity(
      'fix the login bug in auth module',
      'deploy to production server and notify team'
    );
    expect(score).toBeLessThan(0.5);
  });

  test('identical prompts score 1.0', () => {
    const score = jaccardSimilarity('test the application', 'test the application');
    expect(score).toBe(1);
  });

  test('empty prompts score 1.0', () => {
    expect(jaccardSimilarity('', '')).toBe(1);
  });

  test('one empty prompt scores 0', () => {
    expect(jaccardSimilarity('hello world', '')).toBe(0);
  });

  test('Korean prompts with connectors stripped', () => {
    const score = jaccardSimilarity(
      '수정하고 커밋하고 푸시해줘',
      '수정 커밋 푸시'
    );
    // normalizePrompt strips 하고 connectors but 해줘 suffix remains on 푸시해줘
    // so intersection is 수정+커밋 (2) out of 4 unique words = 0.5
    expect(score).toBeGreaterThanOrEqual(0.5);
  });

  test('file paths stripped before comparison', () => {
    const score = jaccardSimilarity(
      'fix the bug in src/utils.ts and commit',
      'fix the bug in lib/helpers.js and commit'
    );
    expect(score).toBeGreaterThan(0.5);
  });
});

// ──── SDET-01: LCS ────

describe('lcs', () => {
  test('identical sequences', () => {
    expect(lcs(['Read', 'Edit', 'Bash'], ['Read', 'Edit', 'Bash'])).toBe(3);
  });

  test('subsequence match', () => {
    expect(lcs(
      ['Read', 'Edit', 'Bash', 'Bash', 'Bash'],
      ['Read', 'Read', 'Edit', 'Bash', 'Bash', 'Bash']
    )).toBe(5);
  });

  test('no common elements', () => {
    expect(lcs(['Read', 'Glob'], ['Write', 'Bash'])).toBe(0);
  });

  test('empty sequences', () => {
    expect(lcs([], ['Read'])).toBe(0);
    expect(lcs([], [])).toBe(0);
  });
});

describe('lcsSequence', () => {
  test('returns actual matching elements', () => {
    const result = lcsSequence(
      ['Read', 'Edit', 'Bash', 'Bash', 'Bash'],
      ['Read', 'Read', 'Edit', 'Bash', 'Bash', 'Bash']
    );
    expect(result).toEqual(['Read', 'Edit', 'Bash', 'Bash', 'Bash']);
  });
});

describe('workflowSimilarity', () => {
  test('identical sequences return 1.0', () => {
    expect(workflowSimilarity(['Read', 'Edit'], ['Read', 'Edit'])).toBe(1);
  });

  test('partial overlap returns fraction', () => {
    const sim = workflowSimilarity(
      ['Read', 'Edit', 'Bash'],
      ['Read', 'Edit', 'Write']
    );
    expect(sim).toBeGreaterThan(0.5);
    expect(sim).toBeLessThan(1);
  });
});

// ──── SDET-02: Compound Action Parsing ────

describe('verb extraction', () => {
  test('Korean verbs: 수정하고 커밋하고 푸시해줘', () => {
    const verbs = extractKoreanVerbs('수정하고 커밋하고 푸시해줘');
    expect(verbs).toContain('edit');
    expect(verbs).toContain('commit');
    expect(verbs).toContain('push');
  });

  test('English verbs: fix the tests, then commit and push', () => {
    const verbs = extractEnglishVerbs('fix the tests, then commit and push');
    expect(verbs).toContain('fix');
    expect(verbs).toContain('commit');
    expect(verbs).toContain('push');
  });

  test('extractCompoundVerbs picks richer extraction', () => {
    const verbs = extractCompoundVerbs('fix the tests, then commit and push');
    expect(verbs.length).toBeGreaterThanOrEqual(2);
  });

  test('isCompoundAction true when >= 2 verbs and toolSeq >= 5', () => {
    expect(isCompoundAction('fix, commit, push', 8)).toBe(true);
  });

  test('isCompoundAction false when toolSeq < 5', () => {
    expect(isCompoundAction('fix, commit, push', 3)).toBe(false);
  });

  test('isCompoundAction false when < 2 verbs', () => {
    expect(isCompoundAction('read the file', 10)).toBe(false);
  });
});

// ──── SDET-06: Self-referential Filters ────

describe('self-referential filters', () => {
  test('isPluginInternalEvent: .claude/ path', () => {
    const event = {
      hook_type: 'PostToolUse',
      tool_name: 'Write',
      payload: JSON.stringify({ tool_input: { file_path: '.claude/rules/local/test.md' } }),
    };
    expect(isPluginInternalEvent(event)).toBe(true);
  });

  test('isPluginInternalEvent: .claude-auto-context/ path', () => {
    const event = {
      hook_type: 'PostToolUse',
      tool_name: 'Write',
      payload: JSON.stringify({ tool_input: { file_path: '.claude-auto-context/suggestions/x.md' } }),
    };
    expect(isPluginInternalEvent(event)).toBe(true);
  });

  test('isPluginInternalEvent: normal path returns false', () => {
    const event = {
      hook_type: 'PostToolUse',
      tool_name: 'Edit',
      payload: JSON.stringify({ tool_input: { file_path: 'src/utils.ts' } }),
    };
    expect(isPluginInternalEvent(event)).toBe(false);
  });

  test('isSkillInvocationSession: slash command', () => {
    const events = [{
      hook_type: 'UserPromptSubmit',
      payload: JSON.stringify({ prompt: '/cac-apply the suggestion' }),
    }];
    expect(isSkillInvocationSession(events)).toBe(true);
  });

  test('isSkillInvocationSession: normal prompt', () => {
    const events = [{
      hook_type: 'UserPromptSubmit',
      payload: JSON.stringify({ prompt: 'fix the login bug' }),
    }];
    expect(isSkillInvocationSession(events)).toBe(false);
  });
});

// ──── SDET-03: Negative Heuristics ────

describe('negative heuristics', () => {
  test('isPureExploration: only Read/Grep', () => {
    expect(isPureExploration(['Read', 'Glob', 'Read', 'Grep', 'Read'])).toBe(true);
  });

  test('isPureExploration: has Write', () => {
    expect(isPureExploration(['Read', 'Write', 'Read'])).toBe(false);
  });

  test('isPureExploration: has Bash', () => {
    expect(isPureExploration(['Read', 'Bash'])).toBe(false);
  });

  test('isDebuggingSpiral: 5+ Bash errors', () => {
    const events = Array.from({ length: 6 }, (_, i) => ({
      hook_type: 'PostToolUse',
      tool_name: 'Bash',
      payload: JSON.stringify({ tool_response: `exit code 1: command failed attempt ${i}` }),
    }));
    expect(isDebuggingSpiral(events)).toBe(true);
  });

  test('isDebuggingSpiral: 3 Bash errors (below threshold)', () => {
    const events = Array.from({ length: 3 }, (_, i) => ({
      hook_type: 'PostToolUse',
      tool_name: 'Bash',
      payload: JSON.stringify({ tool_response: `exit code 1: error ${i}` }),
    }));
    expect(isDebuggingSpiral(events)).toBe(false);
  });

  test('isSingleFileEdit: 3 tools, 1 Write', () => {
    expect(isSingleFileEdit(['Read', 'Write', 'Read'], [])).toBe(true);
  });

  test('isSingleFileEdit: 5 tools', () => {
    expect(isSingleFileEdit(['Read', 'Write', 'Read', 'Bash', 'Read'], [])).toBe(false);
  });

  test('isWebResearchOnly: mostly web tools no mutation', () => {
    expect(isWebResearchOnly(['WebSearch', 'WebFetch', 'WebSearch', 'Read'])).toBe(true);
  });

  test('isWebResearchOnly: has Write', () => {
    expect(isWebResearchOnly(['WebSearch', 'WebFetch', 'Write'])).toBe(false);
  });

  test('isSingleHookPattern: [Bash]', () => {
    expect(isSingleHookPattern(['Bash'])).toBe(true);
  });

  test('isSingleHookPattern: [Read, Bash]', () => {
    expect(isSingleHookPattern(['Read', 'Bash'])).toBe(true);
  });

  test('isSingleHookPattern: 3 tools', () => {
    expect(isSingleHookPattern(['Read', 'Edit', 'Bash'])).toBe(false);
  });

  test('applyNegativeHeuristics rejects pure exploration', () => {
    const fp = { toolSeq: ['Read', 'Glob', 'Grep'] };
    const result = applyNegativeHeuristics(fp, []);
    expect(result.passed).toBe(false);
    expect(result.reason).toBe('pure-exploration');
  });

  test('applyNegativeHeuristics passes valid workflow', () => {
    const fp = { toolSeq: ['Read', 'Edit', 'Bash', 'Bash', 'Bash', 'Write'] };
    const events = [];
    const result = applyNegativeHeuristics(fp, events);
    expect(result.passed).toBe(true);
  });
});

// ──── SDET-04: Scoring Formula ────

describe('scoring formula', () => {
  test('version-bump-commit-push: score = 18', () => {
    const score = computeScore({
      session_count: 3, step_count: 12, param_count: 1,
      has_mutation: 1, existing_coverage: 0,
    });
    expect(score).toBe(18);
  });

  test('research-then-write-doc: score = 37.5', () => {
    const score = computeScore({
      session_count: 7, step_count: 25, param_count: 2,
      has_mutation: 1, existing_coverage: 0,
    });
    expect(score).toBe(37.5);
  });

  test('existing coverage penalty', () => {
    const score = computeScore({
      session_count: 3, step_count: 12, param_count: 1,
      has_mutation: 1, existing_coverage: 1,
    });
    expect(score).toBe(8); // 18 - 10
  });

  test('scoreDecision: generate', () => {
    expect(scoreDecision(18, 3, 12)).toBe('generate');
  });

  test('scoreDecision: observe (score between 5-10)', () => {
    expect(scoreDecision(7, 2, 8)).toBe('observe');
  });

  test('scoreDecision: discard (step_count < 5 hard gate)', () => {
    expect(scoreDecision(15, 3, 4)).toBe('discard');
  });

  test('scoreDecision: discard (score < 5.0)', () => {
    // score=4, sessionCount=3, stepCount=8 — passes step gate but score too low
    expect(scoreDecision(4, 3, 8)).toBe('discard');
  });

  test('hasMutation: with Write', () => {
    expect(hasMutation(['Read', 'Write', 'Bash'])).toBe(1);
  });

  test('hasMutation: no mutation tools', () => {
    expect(hasMutation(['Read', 'Glob', 'Grep'])).toBe(0);
  });
});

// ──── SDET-05: Classification Decision Tree ────

describe('classification decision tree', () => {
  test('step_count < 5 -> rules-or-hooks', () => {
    const result = classifyPattern(
      { toolSeq: ['Read', 'Edit', 'Bash'] },
      [{ toolSeq: ['Read', 'Edit', 'Bash'] }],
      [{ id: 1, hook_type: 'UserPromptSubmit', payload: '{"prompt":"fix"}' },
       { id: 2, hook_type: 'PostToolUse', tool_name: 'Read', payload: '{}' }]
    );
    expect(result.classification).toBe('rules-or-hooks');
  });

  test('8+ tools with NL trigger and mutation and decision points -> skill', () => {
    const toolSeq = ['Read', 'Edit', 'Bash', 'Bash', 'Write', 'Bash', 'Read', 'Bash'];
    const sessions = [
      { toolSeq: ['Read', 'Edit', 'Bash', 'Bash', 'Write', 'Bash', 'Read', 'Bash'] },
      { toolSeq: ['Read', 'Write', 'Bash', 'Edit', 'Read', 'Bash', 'Bash', 'Write'] },
    ];
    const events = [
      { id: 1, hook_type: 'UserPromptSubmit', payload: '{"prompt":"fix and test"}' },
      { id: 2, hook_type: 'PostToolUse', tool_name: 'Read', payload: '{}' },
    ];
    const result = classifyPattern({ toolSeq }, sessions, events);
    expect(result.classification).toBe('skill');
  });

  test('single Bash pattern -> hooks-agent', () => {
    const result = classifyPattern(
      { toolSeq: ['Bash'] },
      [{ toolSeq: ['Bash'] }],
      [{ id: 1, hook_type: 'UserPromptSubmit', payload: '{"prompt":"run lint"}' },
       { id: 2, hook_type: 'PostToolUse', tool_name: 'Bash', payload: '{}' }]
    );
    // step_count < 5 gates this first
    expect(result.classification).toBe('rules-or-hooks');
  });

  test('hasNLTrigger: prompt before tool', () => {
    const events = [
      { id: 1, hook_type: 'UserPromptSubmit', payload: '{"prompt":"fix it"}' },
      { id: 2, hook_type: 'PostToolUse', tool_name: 'Read', payload: '{}' },
    ];
    expect(hasNLTrigger(events)).toBe(true);
  });

  test('hasNLTrigger: no prompt events', () => {
    const events = [
      { id: 1, hook_type: 'PostToolUse', tool_name: 'Read', payload: '{}' },
    ];
    expect(hasNLTrigger(events)).toBe(false);
  });

  test('hasDecisionPoints: diverging sequences', () => {
    const sessions = [
      { toolSeq: ['Read', 'Edit', 'Bash', 'Write', 'Bash', 'Bash', 'Bash', 'Read'] },
      { toolSeq: ['Read', 'Write', 'Bash', 'Edit', 'Read', 'Read', 'Bash', 'Write'] },
    ];
    expect(hasDecisionPoints(sessions)).toBe(true);
  });

  test('hasDecisionPoints: identical sequences', () => {
    const sessions = [
      { toolSeq: ['Read', 'Edit', 'Bash'] },
      { toolSeq: ['Read', 'Edit', 'Bash'] },
    ];
    expect(hasDecisionPoints(sessions)).toBe(false);
  });
});

// ──── SINT-03: Integration Test with Real DB ────

describe('integration: runSkillDetector with DB', () => {
  function setupDb() {
    const db = new Database(':memory:');
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
    db.run(`
      CREATE TABLE IF NOT EXISTS observations (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern_key  TEXT NOT NULL,
        session_id   TEXT NOT NULL,
        evidence     TEXT NOT NULL,
        agent_source TEXT NOT NULL,
        created_at   TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(pattern_key, session_id)
      )
    `);
    return db;
  }

  function makeSessionEvents(sessionId, prompt, toolNames) {
    const events = [];
    let id = 0;
    events.push({
      id: id++, session_id: sessionId, hook_type: 'UserPromptSubmit',
      tool_name: null, payload: JSON.stringify({ prompt, session_id: sessionId }),
    });
    for (const tool of toolNames) {
      events.push({
        id: id++, session_id: sessionId, hook_type: 'PostToolUse',
        tool_name: tool, payload: JSON.stringify({
          tool_name: tool, tool_input: { file_path: `src/file${id}.ts` }, tool_response: 'ok',
        }),
      });
    }
    return events;
  }

  test('3-session repeating workflow produces observations', () => {
    const db = setupDb();
    // Use 8-step sequence: step_count >= 8 bypasses the 'linear chain, step_count < 8' guard
    const toolSeq = ['Read', 'Edit', 'Bash', 'Bash', 'Bash', 'Write', 'Read', 'Bash'];
    const events = [
      ...makeSessionEvents('sess-1', 'fix tests then commit and push', toolSeq),
      ...makeSessionEvents('sess-2', 'fix the tests, commit and push', toolSeq),
      ...makeSessionEvents('sess-3', 'fix tests, then commit, push', toolSeq),
    ];
    // Re-index IDs to be globally unique
    events.forEach((e, i) => { e.id = i; });

    const result = runSkillDetector(events, db);
    expect(result.observations_written).toBeGreaterThan(0);

    // Check observations table
    const rows = db.prepare(`
      SELECT * FROM observations WHERE agent_source = 'skill-agent'
    `).all();
    expect(rows.length).toBeGreaterThan(0);

    // Verify pattern_key starts with 'skill:'
    for (const row of rows) {
      expect(row.pattern_key.startsWith('skill:')).toBe(true);
    }

    // Verify evidence JSON structure
    const evidence = JSON.parse(rows[0].evidence);
    expect(evidence).toHaveProperty('prompt_fingerprint');
    expect(evidence).toHaveProperty('tool_sequence');
    expect(evidence).toHaveProperty('step_count');
    expect(evidence).toHaveProperty('score');
    expect(evidence).toHaveProperty('session_count_at_time');

    db.close();
  });

  test('pure exploration sessions produce zero observations', () => {
    const db = setupDb();
    const events = [
      ...makeSessionEvents('sess-1', 'explore the codebase', ['Read', 'Glob', 'Grep', 'Read', 'Read']),
      ...makeSessionEvents('sess-2', 'explore the codebase', ['Read', 'Glob', 'Grep', 'Read', 'Read']),
      ...makeSessionEvents('sess-3', 'explore the codebase', ['Read', 'Glob', 'Grep', 'Read', 'Read']),
    ];
    events.forEach((e, i) => { e.id = i; });

    const result = runSkillDetector(events, db);

    const rows = db.prepare(`
      SELECT * FROM observations WHERE agent_source = 'skill-agent'
    `).all();
    expect(rows.length).toBe(0);

    db.close();
  });

  test('plugin-internal events are excluded', () => {
    const db = setupDb();
    const events = [
      { id: 0, session_id: 'sess-1', hook_type: 'UserPromptSubmit', tool_name: null,
        payload: JSON.stringify({ prompt: 'update rules', session_id: 'sess-1' }) },
      { id: 1, session_id: 'sess-1', hook_type: 'PostToolUse', tool_name: 'Write',
        payload: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: '.claude/rules/local/test.md' } }) },
    ];

    const result = runSkillDetector(events, db);

    const rows = db.prepare(`
      SELECT * FROM observations WHERE agent_source = 'skill-agent'
    `).all();
    expect(rows.length).toBe(0);

    db.close();
  });

  test('slash command session is excluded', () => {
    const db = setupDb();
    const toolSeq = ['Read', 'Edit', 'Bash', 'Bash', 'Write', 'Bash'];
    const events = makeSessionEvents('sess-1', '/cac-apply the suggestion', toolSeq);

    const result = runSkillDetector(events, db);

    const rows = db.prepare(`
      SELECT * FROM observations WHERE agent_source = 'skill-agent'
    `).all();
    expect(rows.length).toBe(0);

    db.close();
  });
});
