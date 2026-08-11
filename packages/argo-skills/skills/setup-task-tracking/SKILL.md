---
name: setup-task-tracking
description: Install Argo's standing task-tracking instruction into a project's agent-facing docs.
disable-model-invocation: true
---

# Setup Task Tracking

Make the harness's to-do list a **standing** habit — in force before a task
starts, rather than something the user asks for once a task has gone sideways.

Both harnesses already ship the tool: Claude Code `TodoWrite`, Codex
`update_plan`. Nothing installs them and no setting turns them on — what decides
whether they get used is the prose loaded at session start. So this skill
installs prose, into the file that is always in context.

That file is the project's agent-facing doc, and the reason is the standing part:
`rules/*.md` load lazily, by `paths:` glob, once a matching file is touched — by
which time the list that should have opened the task is already late. The doc is
read before the first move.

## 1. Pick the file to wire

Write to **the project docs that already exist**:

- Both `CLAUDE.md` and `AGENTS.md` present, and `CLAUDE.md` merely imports
  `AGENTS.md` (its whole body is `@AGENTS.md`)? Wire `AGENTS.md` only — wiring
  both would duplicate the section via the import.
- Both present and independent? Wire both.
- Only one present? Wire that one, and leave the other absent. A stub `AGENTS.md`
  holding nothing but this section is worse than no file: the harness that reads
  it gets a project doc missing every convention the real one carries, and the
  two drift from the first commit.
- Neither present? Create `AGENTS.md`, and say so in the report — you are
  creating the project's first agent-facing doc, which is a bigger act than this
  skill was asked for.

Done when every file you will write is named and the ones you deliberately left
alone are named too.

## 2. Write the section

Copy verbatim into each wired file. The thresholds are what make it work — a
softened version ("consider tracking progress") reads as optional and changes
nothing:

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
- Keep single-step edits, lookups, and conversational turns off the list — a
  one-item list is noise, and a list nobody needed teaches the next session to
  ignore lists.
```

Adapt only the tool names, and only to match reality: name the harnesses this
project actually uses, and drop the rest. A section naming a tool the running
agent doesn't have is a section it learns to discount.

Where a `## Task tracking` section already exists, replace it in place — a second
copy makes the doc self-contradicting the first time the two versions drift.

Done when each wired file holds exactly one `## Task tracking` section.

## 3. Report

Name the file(s) wired, the harnesses named in the section, and that it takes
effect on the next session or `/clear` — a project doc already in context is not
re-read mid-session.
