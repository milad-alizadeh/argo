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

Run the `argo-skills` scaffolder from the target project's root. It reads Argo's
`skills-lock.json` manifest and installs every skill it names with one
`npx skills add` per source — the four third-party sources
(`mattpocock/skills`, `vercel-labs/skills`, `anthropics/claude-plugins-official`,
`anthropics/skills`) plus Argo's own skills, installed from GitHub
(`milad-alizadeh/argo`) like any other source:

```bash
npx github:milad-alizadeh/argo    # canonical — installs everything from GitHub
```

Preview with `--dry-run`. Install a subset with `--skill a,b`. Skills land in
`.claude/skills/` + `.agents/skills/`, recorded in the project's
`skills-lock.json`. If the project already has a lock, this is an update, not a
first install — say so and continue; entries the project locked itself are kept.

Every source installs from its repo — including Argo's own skills. A new or edited
skill must be **pushed** before a reinstall picks it up.

## Phase 2 — the infra wizard

**Detect before asking.** Look at the repo first so every question ships a
recommendation instead of a blank menu:

- Language/UI: `.ts/.tsx` present? A components dir? Tailwind/Tamagui in
  package.json? → informs rules + design handoff.
- Scale: monorepo workspaces? >~30 source files? → informs graphify + boundaries.
- Git hygiene: `.husky/` or hooks already present? CI workflows?
- Linter: a `biome.json`, `eslint.config.*`, `.oxlintrc.json`, `ruff.toml`? → informs
  quality gates (the existing linter is the one that gets the caps; never add a second).

Then ask **one grouped multi-select question** — "which of these do you want set
up?" — with the detected recommendation marked, covering:

| Choice | Delegates to | Recommend when |
|---|---|---|
| House engineering rules | `setup-rules` | always |
| Terse output style (Claude Code default) | `setup-output-style` | always |
| Pre-commit hooks (format/typecheck/test) | `setup-pre-commit` | package.json exists |
| Quality gates (caps + duplication, as errors) | `setup-quality-gates` | repo has (or should have) a linter |
| Knowledge graph (committed, hook-refreshed) | `setup-graphify` | repo beyond trivial size |
| Module boundaries (dependency-cruiser) | `setup-module-boundaries` | monorepo / layered app |
| Design handoff (tokens, studies, check) | `setup-design-handoff` | project has UI |
| Visual verification (screenshot script + verify stage) | `setup-visual-verify` | project has UI |
| Cross-CLI guardrail hooks (graphify-guard, worktree guard + reaper) | scaffolder `--hooks` | user runs git worktrees / wants graphify-before-grep |

## Phase 3 — dispatch in order

Run each chosen skill **in this order** (later ones build on earlier ones):

1. `setup-rules` — the prose contracts; design handoff and studies reference them.
2. `setup-pre-commit` — husky baseline that later steps append to.
3. `setup-quality-gates` — the arithmetic half of step 1's rules, as build failures;
   appends to step 2's hook and lands the caps the rules state in prose.
4. `setup-graphify` — appends its refresh block to the pre-commit hook.
5. `setup-module-boundaries` — lint config + CI gate.
6. `setup-design-handoff` — token contract, study scaffolding, design-token
   check; depends on the rules from step 1.
7. `setup-visual-verify` — screenshot script + declared render method; points at
   the studies/Storybook that step 6 (or the app) provides.
8. `setup-output-style` — Terse output style as the Claude Code session default;
   independent of the rest, so it can run any time.
9. Guardrail hooks (if chosen) — re-run the scaffolder with `--hooks`
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
