---
globs:
  - ".claude-auto-context/*.mjs"
---

# Syntax Check Required After Editing .mjs Files

After editing any `.mjs` file in `.claude-auto-context/`, run `bun --check` before declaring the task complete.

```sh
bun --check .claude-auto-context/worker.mjs
bun --check .claude-auto-context/skill-detector.mjs
```

**Do NOT use `node --check` or `esbuild`** — both fail to resolve `bun:` imports (e.g., `bun:sqlite`) and will report false errors.

Evidence: sessions 615e4373 (explicit '구문 검증' task in plan) and fb9f05d6 (bun --check run after scoreDecision/classifyPattern edits).
