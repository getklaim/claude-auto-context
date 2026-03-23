#!/usr/bin/env bun
// quality-gate.mjs — Rule-based quality evaluation for agent-generated context
// Deterministic checks, no LLM calls. Auto-fixes minor issues, reverts failures.
// 11 checks across 3 file types: rules, CLAUDE.md, suggestions.

import { existsSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from 'fs';
import { resolve, basename } from 'path';

// ─── Helpers ────────────────────────────────────────────

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const yaml = match[1];
  const result = {};
  let currentKey = null;
  for (const line of yaml.split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)/);
    if (kv) {
      currentKey = kv[1];
      const val = kv[2].trim();
      result[currentKey] = val ? val.replace(/^["']|["']$/g, '') : [];
      continue;
    }
    const arr = line.match(/^\s+-\s*(.+)/);
    if (arr && currentKey && Array.isArray(result[currentKey])) {
      result[currentKey].push(arr[1].trim().replace(/^["']|["']$/g, ''));
    }
  }
  return result;
}

function extractBody(content) {
  const fm = content.match(/^---\n[\s\S]*?\n---\n*/);
  return fm ? content.slice(fm[0].length).trim() : content.trim();
}

function extractGlobs(fm) {
  const val = fm?.globs || fm?.paths;
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function wordSet(text) {
  return new Set(
    text.toLowerCase().replace(/[^a-z0-9\u3131-\uD79D\s]/g, ' ')
      .split(/\s+/).filter(w => w.length > 2)
  );
}

function jaccardSimilarity(a, b) {
  const sa = wordSet(a), sb = wordSet(b);
  if (sa.size === 0 && sb.size === 0) return 1;
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter++;
  return inter / (sa.size + sb.size - inter);
}

function globHasMatches(pattern, cwd) {
  try {
    const g = new Bun.Glob(pattern);
    for (const _ of g.scanSync(cwd)) return true;
    return false;
  } catch { return true; } // invalid glob → don't reject
}

// ─── Rules File Checks ─────────────────────────────────
// Each returns { id, name, severity, passed, detail, autoFix? }
// severity: 'critical' = revert on fail, 'warn' = log only

function checkFrontmatterPresence(content) {
  const has = /^---\n[\s\S]*?\n---/.test(content);
  return { id: 'Q-01', name: 'frontmatter-presence', severity: 'critical',
    passed: has, detail: has ? 'YAML frontmatter present' : 'Missing YAML frontmatter' };
}

function checkFrontmatterKey(content) {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return { id: 'Q-02', name: 'frontmatter-key', severity: 'critical',
    passed: true, detail: 'No frontmatter' };
  if (/^paths:/m.test(fmMatch[1]) && !/^globs:/m.test(fmMatch[1])) {
    return { id: 'Q-02', name: 'frontmatter-key', severity: 'critical',
      passed: false, detail: '"paths:" used instead of "globs:" — applies rule to ALL files',
      autoFix: (c) => c.replace(/^---\n([\s\S]*?)\n---/, (_, yaml) =>
        `---\n${yaml.replace(/^paths:/m, 'globs:')}\n---`) };
  }
  return { id: 'Q-02', name: 'frontmatter-key', severity: 'critical',
    passed: true, detail: 'Correct key: globs' };
}

function checkGlobsMatchFiles(content, projectRoot) {
  const fm = parseFrontmatter(content);
  const globs = extractGlobs(fm);
  if (globs.length === 0) return { id: 'Q-03', name: 'globs-match', severity: 'warn',
    passed: true, detail: 'No globs defined' };
  for (const p of globs) {
    if (globHasMatches(p, projectRoot)) {
      return { id: 'Q-03', name: 'globs-match', severity: 'warn',
        passed: true, detail: `"${p}" matches files` };
    }
  }
  return { id: 'Q-03', name: 'globs-match', severity: 'warn',
    passed: false, detail: `No files match: ${globs.join(', ')}` };
}

function checkContentSubstance(content) {
  const body = extractBody(content);
  const ok = body.length >= 20;
  return { id: 'Q-04', name: 'content-substance', severity: 'critical',
    passed: ok, detail: ok ? `${body.length} chars` : `Too short: ${body.length} chars (min 20)` };
}

function checkContentLength(content) {
  const body = extractBody(content);
  const ok = body.length <= 1000;
  return { id: 'Q-05', name: 'content-length', severity: 'warn',
    passed: ok, detail: ok ? `${body.length} chars` : `Verbose: ${body.length} chars (> 1000)` };
}

function checkNotDuplicate(content, existingRules) {
  const body = extractBody(content);
  for (const [path, existing] of Object.entries(existingRules)) {
    const existingBody = extractBody(existing);
    if (existingBody.length < 20) continue;
    const sim = jaccardSimilarity(body, existingBody);
    if (sim > 0.7) {
      return { id: 'Q-06', name: 'not-duplicate', severity: 'critical',
        passed: false, detail: `${Math.round(sim * 100)}% similar to ${basename(path)}` };
    }
  }
  return { id: 'Q-06', name: 'not-duplicate', severity: 'critical',
    passed: true, detail: 'No duplicates' };
}

// ─── CLAUDE.md Checks ───────────────────────────────────
// Q-07, Q-08 removed — claudemd-agent has full edit freedom.
// Only Q-09 (duplicate detection) remains as a warning.

function checkClaudeMdNotDuplicate(before, after) {
  if (!before) return { id: 'Q-09', name: 'claudemd-no-dup', severity: 'warn',
    passed: true, detail: 'New file' };
  const al = after.split('\n').filter(l => l.trim());
  // Check for duplicate lines within the final content
  for (let i = 0; i < al.length; i++) {
    for (let j = i + 1; j < al.length; j++) {
      if (al[i].trim() && jaccardSimilarity(al[i], al[j]) > 0.8) {
        return { id: 'Q-09', name: 'claudemd-no-dup', severity: 'warn',
          passed: false, detail: `Duplicates: "${al[i].trim().slice(0, 60)}"` };
      }
    }
  }
  return { id: 'Q-09', name: 'claudemd-no-dup', severity: 'warn',
    passed: true, detail: 'No duplicate content' };
}

// ─── Suggestion Checks ──────────────────────────────────

function checkSuggestionSections(content) {
  const required = ['## Status', '## Category', '## Problem', '## Proposal'];
  const missing = required.filter(s => !content.includes(s));
  return { id: 'Q-10', name: 'suggestion-sections', severity: 'critical',
    passed: missing.length === 0,
    detail: missing.length === 0 ? 'All sections present' : `Missing: ${missing.join(', ')}` };
}

function checkSuggestionStatus(content) {
  const m = content.match(/## Status\n(\w+)/);
  if (!m) return { id: 'Q-11', name: 'suggestion-status', severity: 'critical',
    passed: false, detail: 'Cannot parse status' };
  if (m[1] !== 'pending') {
    return { id: 'Q-11', name: 'suggestion-status', severity: 'critical',
      passed: false, detail: `Status "${m[1]}" instead of "pending"`,
      autoFix: (c) => c.replace(/## Status\n\w+/, '## Status\npending') };
  }
  return { id: 'Q-11', name: 'suggestion-status', severity: 'critical',
    passed: true, detail: 'Status: pending' };
}

// ─── Snapshot ───────────────────────────────────────────

export function takeContentSnapshot(projectRoot) {
  const snapshot = {};
  const rulesDir = resolve(projectRoot, '.claude', 'rules');
  const claudeMdPath = resolve(projectRoot, 'CLAUDE.md');
  const suggestionsDir = resolve(projectRoot, '.claude-auto-context', 'suggestions');

  if (existsSync(rulesDir)) {
    for (const f of readdirSync(rulesDir)) {
      if (!f.endsWith('.md')) continue;
      snapshot[resolve(rulesDir, f)] = readFileSync(resolve(rulesDir, f), 'utf8');
    }
  }
  if (existsSync(claudeMdPath)) {
    snapshot[claudeMdPath] = readFileSync(claudeMdPath, 'utf8');
  }
  if (existsSync(suggestionsDir)) {
    for (const f of readdirSync(suggestionsDir)) {
      if (!f.endsWith('.md')) continue;
      snapshot[resolve(suggestionsDir, f)] = readFileSync(resolve(suggestionsDir, f), 'utf8');
    }
  }
  return snapshot;
}

export function hasContentChanged(before, after) {
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of allKeys) {
    if (before[key] !== after[key]) return true;
  }
  return false;
}

// ─── File Evaluator ─────────────────────────────────────

function evaluateFile(filePath, contentAfter, contentBefore, fileType, existingRules, projectRoot) {
  let content = contentAfter;
  const checks = [];
  const autoFixes = [];

  if (fileType === 'rule') {
    checks.push(
      checkFrontmatterPresence(content),
      checkFrontmatterKey(content),
      checkGlobsMatchFiles(content, projectRoot),
      checkContentSubstance(content),
      checkContentLength(content),
      checkNotDuplicate(content, existingRules)
    );
  } else if (fileType === 'claudemd') {
    checks.push(
      checkClaudeMdNotDuplicate(contentBefore, content)
    );
  } else if (fileType === 'suggestion') {
    checks.push(
      checkSuggestionSections(content),
      checkSuggestionStatus(content)
    );
  }

  // Apply auto-fixes for failed checks
  for (const check of checks) {
    if (!check.passed && check.autoFix) {
      const fixed = check.autoFix(content);
      if (fixed !== content) {
        content = fixed;
        autoFixes.push(check.id);
        check.passed = true;
        check.detail = `[auto-fixed] ${check.detail}`;
      }
    }
  }

  // Write back auto-fixed content
  if (autoFixes.length > 0) {
    writeFileSync(filePath, content);
  }

  // Verdict: fail if any critical check failed
  const criticalFails = checks.filter(c => !c.passed && c.severity === 'critical');
  const verdict = criticalFails.length === 0 ? 'pass' : 'fail';

  return { filePath, fileType, verdict, checks, autoFixes, content };
}

// ─── Gate Runner ────────────────────────────────────────

export function runQualityGate(snapshotBefore, projectRoot) {
  const snapshotAfter = takeContentSnapshot(projectRoot);
  const rulesDir = resolve(projectRoot, '.claude', 'rules');
  const claudeMdPath = resolve(projectRoot, 'CLAUDE.md');
  const suggestionsDir = resolve(projectRoot, '.claude-auto-context', 'suggestions');

  // Find changed/new files
  const changes = [];
  for (const [path, contentAfter] of Object.entries(snapshotAfter)) {
    const contentBefore = snapshotBefore[path] ?? null;
    if (contentBefore === null || contentBefore !== contentAfter) {
      let fileType = 'unknown';
      if (path === claudeMdPath) fileType = 'claudemd';
      else if (path.startsWith(rulesDir + '/')) fileType = 'rule';
      else if (path.startsWith(suggestionsDir + '/')) fileType = 'suggestion';

      changes.push({ path, contentBefore, contentAfter, fileType,
        action: contentBefore === null ? 'created' : 'modified' });
    }
  }

  if (changes.length === 0) {
    return { evaluated: 0, passed: 0, failed: 0, autoFixed: 0, results: [] };
  }

  // Build existing rules map (pre-change state) for duplicate detection
  const existingRules = {};
  for (const [path, content] of Object.entries(snapshotBefore)) {
    if (path.startsWith(rulesDir + '/')) existingRules[path] = content;
  }

  const results = [];
  let passed = 0, failed = 0, autoFixed = 0;

  for (const change of changes) {
    const result = evaluateFile(
      change.path, change.contentAfter, change.contentBefore,
      change.fileType, existingRules, projectRoot
    );
    result.action = change.action;

    if (result.verdict === 'fail') {
      // Revert: restore original content or delete new file
      if (change.contentBefore !== null) {
        writeFileSync(change.path, change.contentBefore);
      } else {
        try { unlinkSync(change.path); } catch {}
      }
      result.reverted = true;
      failed++;
    } else {
      result.reverted = false;
      passed++;
      // Track passed rules for cross-batch duplicate detection
      if (change.fileType === 'rule') {
        existingRules[change.path] = result.content;
      }
    }

    if (result.autoFixes.length > 0) autoFixed++;
    results.push(result);
  }

  return { evaluated: changes.length, passed, failed, autoFixed, results };
}
