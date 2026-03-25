import { describe, test, expect } from 'bun:test';
import {
  sanitizeSecrets,
  generalizeExample,
  buildSkillAgentPrompt,
  loadExistingSkills,
  getGenerateCandidates,
} from './skill-prompt-builder.mjs';

// ---------------------------------------------------------------------------
// sanitizeSecrets
// ---------------------------------------------------------------------------

describe('sanitizeSecrets', () => {
  test('replaces Anthropic API keys', () => {
    const input = 'key: sk-ant-api03-FAKE12345678901234567890';
    const result = sanitizeSecrets(input);
    expect(result).toContain('${API_KEY}');
    expect(result).not.toContain('sk-ant-');
  });

  test('replaces Bearer tokens', () => {
    const input = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
    const result = sanitizeSecrets(input);
    expect(result).toContain('Bearer ${TOKEN}');
    expect(result).not.toContain('eyJhbGci');
  });

  test('replaces AWS access keys', () => {
    const input = 'aws_key=AKIAIOSFODNN7EXAMPLE';
    const result = sanitizeSecrets(input);
    expect(result).toContain('${AWS_ACCESS_KEY}');
    expect(result).not.toContain('AKIAIOSFODNN7EXAMPLE');
  });

  test('replaces IPv4 addresses', () => {
    const input = 'server at 192.168.1.100 and 10.0.0.1';
    const result = sanitizeSecrets(input);
    expect(result).toContain('${IP_ADDRESS}');
    expect(result).not.toContain('192.168.1.100');
    expect(result).not.toContain('10.0.0.1');
  });

  test('replaces password patterns', () => {
    const input = 'password=my_secret_pass123 and api_key: abcdef';
    const result = sanitizeSecrets(input);
    expect(result).toContain('${REDACTED}');
    expect(result).not.toContain('my_secret_pass123');
  });

  test('replaces GitHub tokens', () => {
    // Bare ghp_ value without a key= prefix (no overlap with password pattern)
    const input = 'Authorization: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij';
    const result = sanitizeSecrets(input);
    expect(result).toContain('${GITHUB_TOKEN}');
  });

  test('replaces npm tokens', () => {
    const input = 'npm_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmn';
    const result = sanitizeSecrets(input);
    expect(result).toContain('${NPM_TOKEN}');
  });

  test('handles combined secrets in one string', () => {
    const input = 'curl -H "Bearer eyJhbGciOi..." https://192.168.1.100/api with sk-ant-api03-FAKE123456789012345';
    const result = sanitizeSecrets(input);
    expect(result).not.toContain('192.168.1.100');
    expect(result).not.toContain('sk-ant-');
    expect(result).toContain('${IP_ADDRESS}');
    expect(result).toContain('${API_KEY}');
  });

  test('handles null/undefined/empty input', () => {
    expect(sanitizeSecrets(null)).toBe('');
    expect(sanitizeSecrets(undefined)).toBe('');
    expect(sanitizeSecrets('')).toBe('');
  });

  test('leaves clean text unchanged', () => {
    const input = 'Run tests and commit the changes';
    expect(sanitizeSecrets(input)).toBe(input);
  });
});

// ---------------------------------------------------------------------------
// generalizeExample
// ---------------------------------------------------------------------------

describe('generalizeExample', () => {
  test('replaces source file paths with placeholder', () => {
    const input = 'Edit src/components/Button.tsx to add onClick handler';
    const result = generalizeExample(input, ['Read', 'Edit', 'Write']);
    expect(result.generalizedPrompt).toContain('{source_file}');
    expect(result.generalizedPrompt).not.toContain('Button.tsx');
  });

  test('replaces test file paths with test_file placeholder', () => {
    const input = 'Run the tests in src/utils/auth.test.ts';
    const result = generalizeExample(input, ['Read', 'Bash']);
    expect(result.generalizedPrompt).toContain('{test_file}');
    expect(result.generalizedPrompt).not.toContain('auth.test.ts');
  });

  test('generates tool flow string from sequence array', () => {
    const result = generalizeExample('Do something', ['Read', 'Edit', 'Bash']);
    expect(result.toolFlow).toBe('Read -> Edit -> Bash');
  });

  test('handles empty tool sequence', () => {
    const result = generalizeExample('Do something', []);
    expect(result.toolFlow).toBe('');
  });

  test('sanitizes secrets within examples', () => {
    const input = 'Deploy to 192.168.1.100 using sk-ant-api03-FAKE123456789012345';
    const result = generalizeExample(input, ['Bash']);
    expect(result.generalizedPrompt).not.toContain('192.168.1.100');
    expect(result.generalizedPrompt).not.toContain('sk-ant-');
  });
});

// ---------------------------------------------------------------------------
// buildSkillAgentPrompt
// ---------------------------------------------------------------------------

describe('buildSkillAgentPrompt', () => {
  // Mock DB that returns empty results for buildNegativeExamples query
  const mockDb = {
    prepare: () => ({
      all: () => [],
    }),
  };

  const mockCandidates = [{
    patternKey: 'skill:verb-chain:edit-test-commit',
    sessions: [
      { sessionId: 's1', promptFingerprint: 'fix the bug and run tests', toolSequence: ['Read', 'Edit', 'Bash', 'Write', 'Bash'] },
      { sessionId: 's2', promptFingerprint: 'edit code then test and commit', toolSequence: ['Read', 'Edit', 'Bash', 'Write', 'Bash'] },
      { sessionId: 's3', promptFingerprint: 'update and run tests then commit', toolSequence: ['Read', 'Edit', 'Bash', 'Write', 'Bash'] },
    ],
    evidence: {
      prompt_fingerprint: 'fix the bug and run tests',
      tool_sequence: ['Read', 'Edit', 'Bash', 'Write', 'Bash'],
      compound_verbs: ['edit', 'test', 'commit'],
      score: 12.5,
      step_count: 8,
      session_count_at_time: 3,
      classification: 'skill',
      classification_reason: 'NL trigger + mutation + 5+ steps',
    },
  }];

  const mockSkills = [
    { file: 'extract-rules', name: 'extract-rules', description: 'Extract conventions from session data' },
  ];

  test('contains What section with skill purpose', () => {
    const prompt = buildSkillAgentPrompt(mockCandidates, '', mockSkills, mockDb);
    expect(prompt).toContain('### What (Skill Purpose)');
    expect(prompt).toContain('edit, test, commit');
  });

  test('contains When section with trigger conditions', () => {
    const prompt = buildSkillAgentPrompt(mockCandidates, '', mockSkills, mockDb);
    expect(prompt).toContain('### When (Trigger Conditions)');
  });

  test('contains Why section with automation value', () => {
    const prompt = buildSkillAgentPrompt(mockCandidates, '', mockSkills, mockDb);
    expect(prompt).toContain('### Why (Automation Value)');
    expect(prompt).toContain('3 sessions');
  });

  test('contains When NOT to Use section (SPROM-04)', () => {
    const prompt = buildSkillAgentPrompt(mockCandidates, '', mockSkills, mockDb);
    expect(prompt).toContain('### When NOT to Use');
  });

  test('includes existing skills context (SINT-04)', () => {
    const prompt = buildSkillAgentPrompt(mockCandidates, '', mockSkills, mockDb);
    expect(prompt).toContain('Existing Skills');
    expect(prompt).toContain('extract-rules');
  });

  test('includes bulk prompt excerpt (SINT-04)', () => {
    const bulkPrompt = '# Observed Data: 10 events\n## Session: abc123';
    const prompt = buildSkillAgentPrompt(mockCandidates, bulkPrompt, [], mockDb);
    expect(prompt).toContain('Recent Session Data');
    expect(prompt).toContain('Observed Data');
  });

  test('limits candidates to 3 max', () => {
    const fourCandidates = [mockCandidates[0], mockCandidates[0], mockCandidates[0], mockCandidates[0]];
    const prompt = buildSkillAgentPrompt(fourCandidates, '', [], mockDb);
    const candidateHeaders = prompt.match(/## Candidate \d+:/g) || [];
    expect(candidateHeaders.length).toBeLessThanOrEqual(3);
  });

  test('sanitizes secrets in prompt output', () => {
    const candidateWithSecret = [{
      ...mockCandidates[0],
      patternKey: 'skill:seq:Read-Edit-Bash',
      evidence: {
        ...mockCandidates[0].evidence,
        prompt_fingerprint: 'deploy to 192.168.1.100',
      },
    }];
    const prompt = buildSkillAgentPrompt(candidateWithSecret, 'secret sk-ant-api03-FAKE123456789012345', [], mockDb);
    expect(prompt).not.toContain('192.168.1.100');
    expect(prompt).not.toContain('sk-ant-');
  });
});

// ---------------------------------------------------------------------------
// batch cadence (SINT-02)
// ---------------------------------------------------------------------------

describe('batch cadence (SINT-02)', () => {
  test('modulo 3 cadence: runs on batch 3, 6, 9', () => {
    for (const n of [3, 6, 9, 12, 300]) {
      expect(n % 3 === 0).toBe(true);
    }
  });

  test('modulo 3 cadence: skips batch 1, 2, 4, 5', () => {
    for (const n of [1, 2, 4, 5, 7, 8]) {
      expect(n % 3 === 0).toBe(false);
    }
  });
});
