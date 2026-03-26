import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync, readdirSync, existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';
import { checkSkillCap } from './skill-cap.mjs';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let tmpRoot;

function setup() {
  // Create a unique temp project root for each test
  tmpRoot = resolve(tmpdir(), `worker-cap-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(resolve(tmpRoot, '.claude-auto-context'), { recursive: true });
}

function teardown() {
  try { rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
}

function writeRegistry(entries) {
  writeFileSync(
    resolve(tmpRoot, '.claude-auto-context', 'skills-registry.json'),
    JSON.stringify(entries)
  );
}

function listSuggestions() {
  const dir = resolve(tmpRoot, '.claude-auto-context', 'suggestions');
  if (!existsSync(dir)) return [];
  return readdirSync(dir);
}

function readSuggestion(filename) {
  return readFileSync(
    resolve(tmpRoot, '.claude-auto-context', 'suggestions', filename),
    'utf8'
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('checkSkillCap', () => {
  beforeEach(setup);
  afterEach(teardown);

  test('registry has 5 skills → atCap: true, suggestion file written', () => {
    const registry = [
      { id: 'skill-a' }, { id: 'skill-b' }, { id: 'skill-c' },
      { id: 'skill-d' }, { id: 'skill-e' }
    ];
    writeRegistry(registry);

    const result = checkSkillCap(tmpRoot, 3);

    expect(result.atCap).toBe(true);
    expect(result.registryCount).toBe(5);
    expect(result.suggestionPath).toBeDefined();

    const suggestions = listSuggestions();
    expect(suggestions.length).toBe(1);
    expect(suggestions[0]).toContain('skill-cap-reached');
  });

  test('registry has 5 skills → suggestion file has ## Status pending and ## Category skill-cap', () => {
    const registry = [
      { id: 'skill-a' }, { id: 'skill-b' }, { id: 'skill-c' },
      { id: 'skill-d' }, { id: 'skill-e' }
    ];
    writeRegistry(registry);

    checkSkillCap(tmpRoot, 6);

    const [filename] = listSuggestions();
    const content = readSuggestion(filename);

    expect(content).toContain('## Status\npending');
    expect(content).toContain('## Category\nskill-cap');
    expect(content).toContain('5/5');
    // filename (not file body) must contain the slug
    expect(filename).toContain('skill-cap-reached');
  });

  test('registry has 4 skills → atCap: false, no suggestion file written', () => {
    const registry = [
      { id: 'skill-a' }, { id: 'skill-b' }, { id: 'skill-c' }, { id: 'skill-d' }
    ];
    writeRegistry(registry);

    const result = checkSkillCap(tmpRoot, 3);

    expect(result.atCap).toBe(false);
    expect(result.registryCount).toBe(4);
    expect(result.suggestionPath).toBeUndefined();
    expect(listSuggestions().length).toBe(0);
  });

  test('registry file does not exist → atCap: false, registryCount: 0', () => {
    // No registry file written
    const result = checkSkillCap(tmpRoot, 3);

    expect(result.atCap).toBe(false);
    expect(result.registryCount).toBe(0);
    expect(listSuggestions().length).toBe(0);
  });

  test('registry file is malformed JSON → atCap: false (graceful degradation)', () => {
    writeFileSync(
      resolve(tmpRoot, '.claude-auto-context', 'skills-registry.json'),
      'this is not valid { json'
    );

    const result = checkSkillCap(tmpRoot, 3);

    expect(result.atCap).toBe(false);
    expect(result.registryCount).toBe(0);
    expect(listSuggestions().length).toBe(0);
  });

  test('registry has exactly 5 skills → filename contains skill-cap-reached and content shows 5/5', () => {
    const registry = Array.from({ length: 5 }, (_, i) => ({ id: `skill-${i}` }));
    writeRegistry(registry);

    const result = checkSkillCap(tmpRoot, 9);

    expect(result.atCap).toBe(true);
    const [filename] = listSuggestions();
    expect(filename).toMatch(/skill-cap-reached\.md$/);

    const content = readSuggestion(filename);
    expect(content).toContain('5/5');
    expect(content).toContain('batch #9');
  });
});
