---
name: setup-task-tracking
description: Install Argo's always-on task-tracking discipline into a project — writes a short "Task tracking" section into the project doc every session already loads (AGENTS.md / CLAUDE.md), naming each harness's own to-do tool so Claude Code and Codex both maintain a live list on multi-step work. Usually dispatched by the /setup-argo-skills wizard; run directly to (re)install just this piece.
disable-model-invocation: true
---

# Setup Task Tracking

Make the harness's to-do list a standing habit rather than something the user has
to ask for on each task.

Both harnesses already *ship* the tool — Claude Code `TodoWrite`, Codex
`update_plan`. Nothing installs them and no setting turns them on; whether they
get used is decided by the instructions loaded at session start. So this skill
installs prose, into the one file that is always in context.

**It does not belong in `rules/`.** Those are loaded lazily, by `paths:` glob,
when a matching file is touched — a working discipline that must apply to a task
before its first file is opened would sit there inert.

## 1. Pick the file to wire

Same choice `setup-rules` makes for its Rules pointer, for the same reason —
write to **the project docs that already exist**:

- Both `CLAUDE.md` and `AGENTS.md` present, and `CLAUDE.md` merely imports
  `AGENTS.md` (its whole body is `@AGENTS.md`)? Put the section in `AGENTS.md`
  only — adding it to both would duplicate it via the import.
- Both present and independent? Wire both.
- **Only one present? Wire that one, and do not create the other.** A stub
  `AGENTS.md` holding nothing but this section is worse than no file: the harness
  that reads it gets a project doc missing every convention the real one carries.
- Neither present? Create `AGENTS.md` **only if** the project has no agent-facing
  doc at all, and say so in the report.

If a `## Task tracking` section is already there, replace it in place rather than
appending a second one.

## 2. Write the section

Copy verbatim — the thresholds are the point, and a softened version ("consider
tracking progress") reliably reads as optional:

```markdown
## Task tracking

Maintain a live to-do list for any task with **three or more distinct steps**,
edits across **multiple files**, or **a plan the user approved**. Claude Code:
`TodoWrite`. Codex: `update_plan`.

- Write the list **before the first edit**, not as a retrospective summary.
- Exactly **one** item `in_progress` at a time; mark it `completed` the moment it
  is done, not in a batch at the end.
- One item = one verifiable outcome. "Fix the bug" is a task; "read the file" is
  not.
- **Skip it** for single-step edits, lookups, and conversational turns — a
  one-item list is noise, and a list nobody needed teaches the next session to
  ignore lists.
```

Adapt only the tool names, and only downward: drop a harness the project doesn't
use (a repo with no `AGENTS.md` and no Codex config is Claude Code-only), and add
one it does — the section is worth nothing if it names a tool the running agent
doesn't have.

## 3. Report

Tell the user which file was wired, which harnesses were named, and that it takes
effect on the next session or `/clear` — an already-loaded project doc is not
re-read mid-session.
