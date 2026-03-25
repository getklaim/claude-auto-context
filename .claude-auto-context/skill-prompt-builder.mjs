#!/usr/bin/env bun
// skill-prompt-builder.mjs — Prompt composition for skill-agent
// Assembles structured prompts from observations data. No LLM calls.
// Exports: sanitizeSecrets, generalizeExample, buildSkillAgentPrompt,
//          loadExistingSkills, getGenerateCandidates

import { resolve } from 'node:path';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

// --- SPROM-03: Secret Sanitization Patterns ---

const SECRET_PATTERNS = [
  { regex: /sk-ant-[a-zA-Z0-9\-_]{20,}/g, replacement: '${API_KEY}' },
  { regex: /Bearer\s+[a-zA-Z0-9\-_.~+/]+=*/g, replacement: 'Bearer ${TOKEN}' },
  { regex: /AKIA[0-9A-Z]{16}/g, replacement: '${AWS_ACCESS_KEY}' },
  { regex: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, replacement: '${IP_ADDRESS}' },
  { regex: /(password|passwd|pwd|secret|token|api_key|apikey)\s*[:=]\s*\S+/gi, replacement: '$1=${REDACTED}' },
  { regex: /gh[ps]_[a-zA-Z0-9]{36,}/g, replacement: '${GITHUB_TOKEN}' },
  { regex: /npm_[a-zA-Z0-9]{36,}/g, replacement: '${NPM_TOKEN}' },
  { regex: /\b[a-f0-9]{40,}\b/g, replacement: '${HASH}' },
];

export function sanitizeSecrets(text) {
  if (!text || typeof text !== 'string') return text || '';
  let result = text;
  for (const { regex, replacement } of SECRET_PATTERNS) {
    // Reset lastIndex for global regexes reused across calls
    regex.lastIndex = 0;
    result = result.replace(regex, replacement);
  }
  return result;
}

// --- SPROM-02: Example Generalization Patterns ---

const PATH_PATTERNS = [
  // Test files
  { regex: /\S+\.(test|spec)\.(ts|js|tsx|jsx|mjs|py)\b/g, replacement: '{test_file}' },
  // Source files with directory
  { regex: /\S+\/\S+\.(ts|js|tsx|jsx|mjs|py|go|rs|java|rb|css|scss|html|vue|svelte)\b/g, replacement: '{source_file}' },
  // Config files
  { regex: /\b(tsconfig|package|webpack|vite|jest|eslint|prettier)\.\w+\b/g, replacement: '{config_file}' },
  // Bare filenames with extension (no path separator)
  { regex: /\b\w+\.(ts|js|tsx|jsx|mjs|py|go|rs|java|rb)\b/g, replacement: '{file}' },
];

const CLI_PATTERNS = [
  // npm/yarn/pnpm commands with args
  { regex: /\b(npm|yarn|pnpm|bun)\s+(run\s+)?\S+(\s+--\S+)*/g, replacement: '{package_command}' },
  // git commands with args
  { regex: /\bgit\s+(push|pull|commit|checkout|merge|rebase)\s+\S*/g, replacement: '{git_command}' },
  // Generic CLI with flags
  { regex: /\b\w+\s+--[\w-]+(=\S+)?(\s+--[\w-]+(=\S+)?)*/g, replacement: '{cli_command}' },
];

export function generalizeExample(promptText, toolSequence) {
  let result = sanitizeSecrets(promptText);

  for (const { regex, replacement } of PATH_PATTERNS) {
    regex.lastIndex = 0;
    result = result.replace(regex, replacement);
  }

  for (const { regex, replacement } of CLI_PATTERNS) {
    regex.lastIndex = 0;
    result = result.replace(regex, replacement);
  }

  // Tool sequence stays as-is (tool names are generic: Read, Write, etc.)
  const seqStr = Array.isArray(toolSequence) ? toolSequence.join(' -> ') : '';

  return { generalizedPrompt: result.trim(), toolFlow: seqStr };
}
