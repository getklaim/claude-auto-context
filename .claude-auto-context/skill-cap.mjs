// skill-cap.mjs — SINT-05 Hard Cap Enforcement for Skill Auto-Generation
// Reads skills-registry.json to enforce a maximum of 5 auto-generated skills.
// When cap is reached, writes a suggestion file instead of invoking the skill-agent.
// Exported for unit testing.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const SKILL_CAP = 5;

/**
 * Check whether the auto-generated skills cap has been reached.
 * If at cap, writes a suggestion file and returns atCap: true.
 * If under cap, returns atCap: false without side effects.
 *
 * @param {string} projectRoot - Absolute path to the project root
 * @param {number} batchCount  - Current batch counter (for suggestion metadata)
 * @returns {{ atCap: boolean, registryCount: number, suggestionPath?: string }}
 */
export function checkSkillCap(projectRoot, batchCount) {
  const registryPath = resolve(projectRoot, '.claude-auto-context', 'skills-registry.json');
  let registryCount = 0;

  if (existsSync(registryPath)) {
    try {
      const reg = JSON.parse(readFileSync(registryPath, 'utf8'));
      registryCount = Array.isArray(reg) ? reg.length : 0;
    } catch {
      // Malformed JSON — treat as empty registry (graceful degradation)
      registryCount = 0;
    }
  }

  if (registryCount >= SKILL_CAP) {
    let suggestionPath;
    try {
      const now = new Date();
      const ts = now.toISOString().replace(/[-:T]/g, '').slice(0, 15).replace(/^(\d{8})(\d{6})/, '$1-$2');
      const suggestionDir = resolve(projectRoot, '.claude-auto-context', 'suggestions');
      mkdirSync(suggestionDir, { recursive: true });
      suggestionPath = resolve(suggestionDir, `suggestion-${ts}-skill-cap-reached.md`);
      const content = `# Suggestion: Skill Auto-Generation Cap Reached (5/5)\n\n## Status\npending\n\n## Created\n${now.toISOString()}\n\n## Category\nskill-cap\n\n## Problem\nThe auto-generated skills registry contains ${registryCount} skills, which is the maximum allowed (5). New skill patterns were detected but cannot be auto-generated until existing skills are reviewed.\n\n## Proposal\nReview existing auto-generated skills in \`.claude/skills/\` and the registry at \`.claude-auto-context/skills-registry.json\`. Archive or delete unused skills to free capacity for new auto-generation.\n\n## Evidence Sessions\n- Detected on batch #${batchCount} at ${now.toISOString()}\n\n## Metrics\n- Registry count: ${registryCount}/5\n- Action required: remove or archive at least 1 skill to resume auto-generation\n`;
      writeFileSync(suggestionPath, content);
    } catch {
      // Non-fatal — suggestion write failure should not crash the worker
    }
    return { atCap: true, registryCount, suggestionPath };
  }

  return { atCap: false, registryCount };
}
