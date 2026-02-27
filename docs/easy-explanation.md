# Auto Context Plugin — The Easy Explanation

## What is this?

There's a program called Claude Code — an AI that helps you write code. But every time you start a new conversation, the AI forgets everything it did before. Like a goldfish.

Auto Context gives this goldfish a diary.

---

## The Two Halves

```
📥 Input (Telling it)              📤 Output (Watching & Learning)
"Here's how this project works"    "Oh, this person codes like that"
```

---

## 📥 Input — Teaching via Rules Files

You drop rule files into your project folder. When Claude touches related files, it automatically reads the matching rules.

```
.claude/rules/
  auth.md     → "Write auth code like this"
  api.md      → "Build APIs like this"
  database.md → "Handle the DB like this"
```

Think of it like signs on a classroom wall. Just like "No running in the hallway," when Claude works in the `auth/` folder, the `auth.md` sign automatically becomes visible.

### Why do it this way?

The alternative is dumping every rule at the start of every conversation — like reading all 100 school rules at morning assembly. Showing only what's needed, when it's needed, is far better.

### What is "tacit knowledge"?

Some things you can't learn just by reading code. For example:

| Type | Example |
|------|---------|
| Rule | "Use Result types for error handling, not try-catch" |
| Prohibition | "Never use the `any` type" |
| How to run | "Run tests with `bun test --filter=unit`" |

These aren't written in the code, so they need to go in rule files.

---

## 📤 Output — Watching and Learning

This is the real magic. It works in 3 stages.

### Stage 1: Recording (Hook)

Every action Claude takes while coding gets silently recorded.

```
Claude searches for a file → 📝 Recorded!
Claude reads a file        → 📝 Recorded!
Claude edits code          → 📝 Recorded!
Claude runs a test         → 📝 Recorded!
```

The recorder (Hook) is dumb. It makes zero judgments. It just takes what it gets and writes it down. Like a student doing dictation.

Records pile up in SQLite, a small database. Like writing in a diary, page after page.

```
Hook (dictation) → Collector (relay) → SQLite (diary)
```

### Stage 2: Analyzing (Background Worker)

This is where a second AI enters the picture.

While you're coding with Claude, another Claude is secretly reading the diary in the background and analyzing it.

```
You ←→ Claude (coding)              ← The AI doing the work

         SQLite (diary)             ← The warehouse
             ↑
        Background Worker            ← The AI observing from behind
```

This "analysis AI" only observes. It never touches code or modifies files. Think of it like a teacher sitting in the back of a classroom, just observing the lesson.

#### How is the analysis AI created?

It uses the `query()` function from `@anthropic-ai/claude-code` to spin up **3 separate Claudes** — each with a different job. All the diary data gets fed to each one in a single big prompt (bulk prompt).

```
Worker collects all diary entries
  │
  ├── Build one big prompt with everything
  │
  ├── query() #1 → Rules Agent     ← "Find coding patterns"
  │                  └── Creates .claude/rules/ files
  │
  ├── query() #2 → Offer Agent     ← "Find structural problems"
  │                  └── Creates offer files in offers/
  │
  └── query() #3 → CLAUDE.md Agent ← "Find project-wide knowledge"
                     └── Updates CLAUDE.md
```

Key characteristics:
- **3 sub-agents, 3 jobs** — each agent focuses on one type of output. This keeps them simple and accurate.
- **Bulk prompt** — all accumulated data is fed at once, so the AI can spot cross-session patterns (e.g., "this happened 5 sessions in a row").
- **Minimal tools** — each agent only gets the file tools it needs (Read, Write, Edit). No terminal access, no web access.
- **Run once and exit** — each agent starts, does its job, and the process exits. No long-running sessions to manage.

### Stage 3: Improving (Output)

When the analysis AI spots patterns, it does 3 things:

**Auto-generated (no approval needed):**
```
.claude/rules/error-handling.md created
→ "Error handling uses Result types"
  (because try-catch → Result conversion was observed 5 times in a row)
```

**CLAUDE.md updated:**
```
"Run tests: bun test --filter=unit"
  (because this command was discovered through repeated fail-then-retry cycles)
```

**Big changes are only suggested:**
```
.claude-auto-context/offers/001-split-utils.md
→ "How about splitting utils.ts into 3 files?"
  (because it was read 8 out of 10 times but only a small part was used each time)
```

Big changes aren't applied automatically — they're written up as **offers**. You have to type `/cac-apply` to execute them. It's like the system asking, "Want me to make this change?"

---

## The Full Picture at a Glance

```
🧑 You: "Fix the auth bug"
     │
     ▼
🤖 Claude (coding up front)
     │
     ├── File search  → 📝 Recorded
     ├── File read    → 📝 Recorded
     ├── Code edit    → 📝 Recorded
     ├── Test run     → 📝 Recorded
     │
     ▼
📓 SQLite Diary
     │
     ▼
🔍 Analysis AI (observing from behind)
     │
     ├── 📋 Auto-generate rule files → Claude reads them automatically next time
     ├── 📝 Update CLAUDE.md         → Notes on how to run things, etc.
     └── 💡 Write up offers          → Applied only when you approve
```

**In one sentence:** It's a system where one Claude watches another Claude code, and gradually makes the project easier and easier to work with.
