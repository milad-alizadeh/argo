---
name: setup-argo-skills
description: Bootstrap a project. Installs the skill bundle, then a wizard that dispatches each chosen piece of infra to its setup skill.
disable-model-invocation: true
---

# Setup Argo Skills

## Phase 1: install the skill bundle

Run `npx github:milad-alizadeh/argo` from the project root (`--dry-run` previews, `--help`
lists the flags). If the project already has a `skills-lock.json`, this is an update: say so
and continue.

Done when the scaffolder exits 0 and the lock delta is in the report.

## Phase 2: the infra wizard

Detect first (language, UI, monorepo, hooks and CI, linter) so every question ships a
recommendation, then ask one grouped multi-select question with the recommendation marked:

| Choice | Delegates to | Recommend when | Order |
|---|---|---|---|
| Quality gates as errors, plus the one-page prose residue | `setup-quality-gates` | always | 1 |
| Design infra and the token values | `setup-design-infra` | project has UI | 2 |
| Always-on task tracking | this skill, below | always | 3 |
| Guardrail hooks | scaffolder `--hooks` | user runs git worktrees | 4 |
| Audit what every session loads | `audit-agent-context` | always | last, since every step above adds to the bill |

Done when the user has answered the one question.

## Phase 3: dispatch in order

Run each chosen skill as a skill; each owns its own detection and wizard. Between steps,
report one line: what was installed, what was deferred.

**Task tracking** is a section, not a skill. Append it verbatim to the project doc that exists
(`AGENTS.md`; `CLAUDE.md` too only if it does not merely import `AGENTS.md`), naming only the
harnesses this project uses, replacing any existing `## Task tracking` section in place:

```markdown
## Task tracking

Maintain a live to-do list for any task with **three or more distinct steps**, edits across
**multiple files**, or **a plan the user approved**. Claude Code: `TodoWrite`. Codex:
`update_plan`.

- Write the list **before the first edit**, not as a retrospective summary.
- Exactly **one** item `in_progress` at a time; mark it `completed` the moment it is done.
- One item = one verifiable outcome. "Fix the bug" is a task; "read the file" is not.
- Keep single-step edits, lookups, and conversational turns off the list.
```

**Issue writing style** is a section, not a skill, and only applies when `docs/agents/issue-tracker.md`
exists (written by `setup-matt-pocock-skills`, a vendored skill this project cannot edit in
place). If that file exists, append this section verbatim, replacing any existing `## Writing
style` section in place:

```markdown
## Writing style

Before you create an issue, edit an issue body, or write a comment, run the `simple-english`
skill on the title and body text. Do this every time, not only when the text reads badly —
apply it before the first draft goes out, not as a later cleanup pass.
```

## Phase 4: report

Skills installed or updated (lock delta), infra installed per piece, anything deferred with
the reason, and how to re-run any single piece (`/setup-<piece>`). If design infra was
installed, the next step is `/prototype` on the first screen.
