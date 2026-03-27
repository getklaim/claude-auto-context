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

// --- SINT-03: Candidates Query and Skills Loader ---

export function getGenerateCandidates(db) {
  const rows = db.prepare(`
    SELECT pattern_key, session_id, evidence
    FROM observations
    WHERE pattern_key LIKE 'skill:%'
      AND agent_source = 'skill-agent'
    ORDER BY created_at DESC
  `).all();

  // Group by pattern_key, filter for generate decision
  const byPattern = new Map();
  for (const row of rows) {
    let ev;
    try { ev = JSON.parse(row.evidence); } catch { continue; }
    if (ev.decision !== 'generate') continue;

    if (!byPattern.has(row.pattern_key)) {
      byPattern.set(row.pattern_key, {
        patternKey: row.pattern_key,
        sessions: [],
        evidence: ev,
      });
    }
    byPattern.get(row.pattern_key).sessions.push({
      sessionId: row.session_id,
      promptFingerprint: ev.prompt_fingerprint || '',
      toolSequence: ev.tool_sequence || [],
    });
  }

  // Return all candidates — agent decides based on judgment criteria
  return [...byPattern.values()];
}

export function loadExistingSkills(root) {
  const skillsDir = resolve(root, '.claude', 'skills');
  if (!existsSync(skillsDir)) return [];

  const entries = readdirSync(skillsDir, { withFileTypes: true });
  return entries
    .filter(e => e.isDirectory())
    .map(dir => {
      const skillPath = resolve(skillsDir, dir.name, 'SKILL.md');
      if (!existsSync(skillPath)) return null;
      const content = readFileSync(skillPath, 'utf8');
      const nameMatch = content.match(/^name:\s*(.+)/m);
      const descMatch = content.match(/^description:\s*(.+)/m);
      return {
        file: dir.name,
        name: nameMatch?.[1]?.trim() || dir.name,
        description: descMatch?.[1]?.trim() || '',
      };
    })
    .filter(Boolean);
}

// --- SPROM-01, SPROM-04: Prompt Composition ---

function buildNegativeExamples(db, patternKey) {
  // Find observations that were NOT classified as skill (for "when NOT to use")
  // Filter by patterns sharing the same verb prefix as the candidate for relevance
  const prefix = patternKey.split(':').slice(0, 2).join(':'); // e.g. 'skill:verb-chain'
  const rows = db.prepare(`
    SELECT evidence FROM observations
    WHERE pattern_key LIKE ? || '%'
      AND agent_source = 'skill-agent'
    ORDER BY created_at DESC
    LIMIT 50
  `).all(prefix);

  const reasons = new Set();
  for (const row of rows) {
    try {
      const ev = JSON.parse(row.evidence);
      if (ev.decision === 'discard' || ev.classification !== 'skill') {
        if (ev.classification_reason) reasons.add(ev.classification_reason);
      }
    } catch {}
  }

  if (reasons.size === 0) {
    return '- Single file edits (quick fixes that do not follow a multi-step workflow)\n- Pure exploration sessions (only reading/searching, no modifications)\n- Debugging spirals (repeated error-fix cycles without a stable pattern)';
  }

  return [...reasons].map(r => `- ${r.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`).join('\n');
}

export function buildSkillAgentPrompt(candidates, bulkPrompt, existingSkills, db) {
  // Limit to top 3 candidates per batch (context window protection)
  const topCandidates = candidates.slice(0, 3);

  let prompt = `# Skill Prompt Composition Request\n\n`;
  prompt += `You are a skill-prompt composer. Analyze the detected workflow patterns below and produce a skill-creator prompt file for each candidate. The prompt file will later be used by skill-creator to generate an actual SKILL.md file.\n\n`;

  prompt += `## Instructions\n\n`;
  prompt += `For each candidate pattern, write a prompt file to:\n`;
  prompt += `\`.claude-auto-context/skill-prompts/skill-YYYYMMDD-HHMMSS-{slug}.md\`\n\n`;
  prompt += `Use current UTC time for the timestamp. The slug should be a kebab-case summary of the skill (e.g., "edit-test-commit").\n\n`;
  prompt += `Each prompt file must contain ALL four sections: What, When, Why, and When NOT to Use.\n\n`;

  for (let i = 0; i < topCandidates.length; i++) {
    const c = topCandidates[i];
    const ev = c.evidence;
    const verbChain = ev.compound_verbs?.join(', ') || 'multi-step workflow';
    const toolSeq = ev.tool_sequence?.join(' -> ') || 'unknown';

    // Generalize session examples
    const examples = c.sessions.slice(0, 3).map(s => {
      const gen = generalizeExample(s.promptFingerprint, s.toolSequence);
      return `  - Prompt: "${gen.generalizedPrompt}"\n    Tools: ${gen.toolFlow}`;
    }).join('\n');

    const negativeExamples = buildNegativeExamples(db, c.patternKey);

    prompt += `---\n\n## Candidate ${i + 1}: ${c.patternKey}\n\n`;

    // What section (SPROM-01)
    prompt += `### What (Skill Purpose)\n`;
    prompt += `This skill automates a **${verbChain}** workflow.\n`;
    prompt += `- Pattern Key: \`${sanitizeSecrets(c.patternKey)}\`\n`;
    prompt += `- Tool Sequence: ${sanitizeSecrets(toolSeq)}\n`;
    prompt += `- Score: ${ev.score} (${ev.session_count_at_time} sessions, ${ev.step_count} steps)\n\n`;

    // When section (SPROM-01)
    prompt += `### When (Trigger Conditions)\n`;
    prompt += `User says something like:\n`;
    prompt += examples + '\n\n';

    // Why section (SPROM-01)
    prompt += `### Why (Automation Value)\n`;
    prompt += `This pattern appeared in **${c.sessions.length} sessions** with **${ev.step_count} tool steps**, `;
    prompt += `suggesting high automation value. Score: ${ev.score}.\n\n`;

    // When NOT to use section (SPROM-04)
    prompt += `### When NOT to Use\n`;
    prompt += `Do NOT trigger this skill for:\n`;
    prompt += negativeExamples + '\n\n';
  }

  // Existing skills context (SINT-04)
  if (existingSkills.length > 0) {
    prompt += `---\n\n## Existing Skills (avoid duplication)\n\n`;
    for (const skill of existingSkills) {
      prompt += `- **${skill.name}**: ${sanitizeSecrets(skill.description)}\n`;
    }
    prompt += `\nDo NOT create a skill that overlaps with any existing skill above.\n\n`;
  }

  // Bulk prompt excerpt for additional context (SINT-04)
  if (bulkPrompt) {
    const truncated = sanitizeSecrets(bulkPrompt.slice(0, 5000));
    prompt += `---\n\n## Recent Session Data (for context)\n\n`;
    prompt += `\`\`\`\n${truncated}\n\`\`\`\n`;
  }

  return prompt;
}
