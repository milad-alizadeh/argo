---
name: setup-argo-skills
description: The ONE project-bootstrap command for Argo tooling. Installs the skill bundle (third-party + Argo's own skills), then runs a wizard over the repo — which infra do you want installed (house rules, graphify knowledge graph, module boundaries, design handoff, pre-commit hooks) — and dispatches each choice to its setup skill. Run once per project; re-run an individual setup-* skill later to redo one piece.
disable-model-invocation: true
---

# Setup Argo Skills

One entry point for setting up a project the Argo way. Two phases: install the
**skills** (so every agent has the same toolbox), then install the **infra** the
user actually wants — each piece delegated to its own `setup-*` skill, so any
piece can be re-run individually later without going through this wizard again.

## Phase 1 — install the skill bundle

Run the `argo-skills` scaffolder from the target project's root. It reads
`bundle.json` and installs every listed source via `npx skills add` — the
third-party `bundle` entries (`mattpocock/skills`, `vercel-labs/skills`,
`anthropics/claude-plugins-official`) and the `mine` entries (Argo's own skills):

```bash
npx github:milad-alizadeh/argo    # canonical — installs everything from GitHub
```

Preview with `--dry-run`. Skills land in `.claude/skills/` + `.agents/skills/`,
recorded in `skills-lock.json`. If the project already has a lock, this is an
update, not a first install — say so and continue.

Every source installs from its repo — including Argo's own skills; even the
argo monorepo dogfoods itself with the same command. A new or edited skill must
be **pushed** before a reinstall picks it up.

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
| Pre-commit hooks (format/typecheck/test) | `setup-pre-commit` | package.json exists |
| Knowledge graph (committed, hook-refreshed) | `setup-graphify` | repo beyond trivial size |
| Module boundaries (dependency-cruiser) | `setup-module-boundaries` | monorepo / layered app |
| Design handoff (tokens, studies, check) | `setup-design-handoff` | project has UI |

## Phase 3 — dispatch in order

Run each chosen skill **in this order** (later ones build on earlier ones):

1. `setup-rules` — the prose contracts; design handoff and studies reference them.
2. `setup-pre-commit` — husky baseline that later steps append to.
3. `setup-graphify` — appends its refresh block to the pre-commit hook.
4. `setup-module-boundaries` — lint config + CI gate.
5. `setup-design-handoff` — token contract, study scaffolding, design-token
   check; depends on the rules from step 1.

Run them as skills (each owns its own detection and wizard details); don't
inline their logic here. Between steps, report one line: what was installed,
what was deferred.

## Phase 4 — report

Summarize the whole bootstrap: skills installed/updated (lock delta), infra
installed per piece, anything deferred with the reason, and the one-liner for
re-running any single piece later (`/setup-<piece>`).

If design handoff was installed, point at the design loop's first move: explore
a moodboard, then run `/design-foundations` to settle the token ramps **before
the first screen study is settled** — `/componentize-design` reconciles screens
against foundations; it doesn't design them.
