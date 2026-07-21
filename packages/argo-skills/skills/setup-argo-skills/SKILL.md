---
name: setup-argo-skills
description: The ONE project-bootstrap command for Argo tooling. Installs the skill bundle (third-party + Argo's own skills), then runs a wizard over the repo — which infra do you want installed (house rules, graphify knowledge graph, module boundaries, design handoff, pre-commit hooks) — and dispatches each choice to its setup skill. Run once per project; re-run an individual setup-* skill later to redo one piece.
disable-model-invocation: true
---

# Setup Argo Skills

One entry point for setting up a project the Argo way: install the **skills** (so
every agent has the same toolbox), then install the **infra** the user actually
wants — each piece delegated to its own `setup-*` skill, so any piece can be re-run
individually later without going through this wizard again.

## Phase 1 — install the skill bundle

Run the `argo-skills` scaffolder from the target project's root. It reads
`bundle.json` and installs every listed source via `npx skills add` — the four
third-party sources (`mattpocock/skills`, `vercel-labs/skills`,
`anthropics/claude-plugins-official`, `anthropics/skills`) plus Argo's own skills,
which are a normal `bundle` entry (`milad-alizadeh/argo`, `"*"`) installed from
GitHub like any other source:

```bash
npx github:milad-alizadeh/argo    # canonical — installs everything from GitHub
```

Preview with `--dry-run`. Skills land in `.claude/skills/` + `.agents/skills/`,
recorded in `skills-lock.json`. If the project already has a lock, this is an
update, not a first install — say so and continue.

Every source installs from its repo — including Argo's own skills. A new or edited
skill must be **pushed** before a reinstall picks it up.

## Phase 2 — the infra wizard

**Detect before asking.** Look at the repo first so every question ships a
recommendation instead of a blank menu:

- Language/UI: `.ts/.tsx` present? A components dir? Tailwind/Tamagui in
  package.json? → informs rules + design handoff.
- Scale: monorepo workspaces? >~30 source files? → informs graphify + boundaries.
- Git hygiene: `.husky/` or hooks already present? CI workflows?

Then ask **one grouped multi-select question** — "which of these do you want set
up?" — with the detected recommendation marked, covering:

| Choice | Delegates to | Recommend when |
|---|---|---|
| House engineering rules | `setup-rules` | always |
| Terse output style (Claude Code default) | `setup-output-style` | always |
| Pre-commit hooks (format/typecheck/test) | `setup-pre-commit` | package.json exists |
| Knowledge graph (committed, hook-refreshed) | `setup-graphify` | repo beyond trivial size |
| Module boundaries (dependency-cruiser) | `setup-module-boundaries` | monorepo / layered app |
| Design handoff (tokens, studies, check) | `setup-design-handoff` | project has UI |
| Visual verification (screenshot script + verify stage) | `setup-visual-verify` | project has UI |
| Cross-CLI guardrail hooks (graphify-guard, worktree guard + reaper) | scaffolder `--hooks` | user runs git worktrees / wants graphify-before-grep |

## Phase 3 — dispatch in order

Run each chosen skill **in this order** (later ones build on earlier ones):

1. `setup-rules` — the prose contracts; design handoff and studies reference them.
2. `setup-pre-commit` — husky baseline that later steps append to.
3. `setup-graphify` — appends its refresh block to the pre-commit hook.
4. `setup-module-boundaries` — lint config + CI gate.
5. `setup-design-handoff` — token contract, study scaffolding, design-token
   check; depends on the rules from step 1.
6. `setup-visual-verify` — screenshot script + declared render method; points at
   the studies/Storybook that step 5 (or the app) provides.
7. `setup-output-style` — Terse output style as the Claude Code session default;
   independent of the rest, so it can run any time.
8. Guardrail hooks (if chosen) — re-run the scaffolder with `--hooks`
   (`npx github:milad-alizadeh/argo --hooks`); it's idempotent, so running it after
   the Phase-1 skills install just adds the hooks. No separate `setup-*` skill.

Run them as skills (each owns its own detection and wizard details); don't
inline their logic here. Between steps, report one line: what was installed,
what was deferred.

## Phase 4 — report

Summarize the whole bootstrap: skills installed/updated (lock delta), infra
installed per piece, anything deferred with the reason, and how to re-run any
single piece later — invoke its `setup-<piece>` skill (Claude Code: `/setup-<piece>`).

If design handoff was installed, point at the design loop's first move: explore
a moodboard, then run the `design-foundations` skill to settle the token ramps **before
the first screen study is settled** — the `componentize-design` skill reconciles screens
against foundations; it doesn't design them.
