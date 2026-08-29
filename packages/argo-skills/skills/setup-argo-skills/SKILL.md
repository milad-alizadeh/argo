---
name: setup-argo-skills
description: The one project-bootstrap command. Installs the skill bundle, then wizards over the repo — which infra do you want — and dispatches each choice to its setup skill.
disable-model-invocation: true
---

# Setup Argo Skills

## Phase 1 — install the skill bundle

Run the `argo-skills` scaffolder from the target project's root. It reads Argo's
`skills-lock.json` manifest and installs every skill it names with one
`npx skills add` per source:

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
- Scale: monorepo workspaces? >~30 source files? → informs boundaries.
- Git hygiene: `.husky/` or hooks already present? CI workflows?
- Linter: a `biome.json`, `eslint.config.*`, `.oxlintrc.json`, `ruff.toml`? → informs
  quality gates (the existing linter is the one that gets the caps; never add a second).

Then ask **one grouped multi-select question** — "which of these do you want set
up?" — with the detected recommendation marked, covering:

| Choice | Delegates to | Recommend when |
|---|---|---|
| House engineering rules | `setup-rules` | always |
| Out Loud output style (Claude Code default) | `setup-output-style` | always |
| Always-on task tracking (TodoWrite / update_plan) | `setup-task-tracking` | always |
| Pre-commit hooks (format/typecheck/test) | `setup-pre-commit` | package.json exists |
| Quality gates (caps + duplication, as errors) | `setup-quality-gates` | repo has (or should have) a linter |
| Module boundaries (dependency-cruiser) | `setup-module-boundaries` | monorepo / layered app |
| Design infra (tokens, `docs/designs/`, check, render method) | `setup-design-infra` | project has UI |
| Design foundations (the token *values*, blessed) | `setup-design-foundations` | project has UI and no settled scale |
| Cross-CLI guardrail hooks (placement, worktree edit and naming guards, reaper) | scaffolder `--hooks` | user runs git worktrees |
| Audit what every session loads, and cut it | `audit-agent-context` | always — it reads rather than installs, and this run adds to the bill it measures |

## Phase 3 — dispatch in order

Run each chosen skill **in this order** (later ones build on earlier ones):

1. `setup-rules` — the prose contracts; design handoff and studies reference them.
2. `setup-pre-commit` — husky baseline that later steps append to.
3. `setup-quality-gates` — the arithmetic half of step 1's rules, as build failures;
   appends to step 2's hook.
4. `setup-module-boundaries` — lint config + CI gate.
5. `setup-design-infra` — token contract, `docs/designs/` scaffolding, the
   no-raw-values check, the render method, and `stack.md`; depends on the rules
   from step 1.
6. `setup-design-foundations` — the token *values*, designed and blessed. Step 5
   installs the structure; this fills it. Skip only if the project already has a
   settled scale in every family.
7. `setup-output-style` — the Out Loud output style as the Claude Code session
   default; independent of the rest, so it can run any time.
8. `setup-task-tracking` — the "Task tracking" section in the project doc; runs
   after `setup-rules` so it lands beside that skill's Rules pointer rather than
   racing it for the same file.
9. Guardrail hooks (if chosen) — re-run the scaffolder with `--hooks`
   (`npx github:milad-alizadeh/argo --hooks`); it's idempotent, so running it after
   the Phase-1 skills install just adds the hooks. No separate `setup-*` skill.
10. `audit-agent-context` — **last**, because every step above adds to what a
   session loads and this is the one that prices it. Report its before/after totals
   as the run's closing line.

Run them as skills (each owns its own detection and wizard details); don't
inline their logic here. Between steps, report one line: what was installed,
what was deferred.

## Phase 4 — report

Summarize the whole bootstrap: skills installed/updated (lock delta), infra
installed per piece, anything deferred with the reason, and how to re-run any
single piece later — invoke its `setup-<piece>` skill (Claude Code: `/setup-<piece>`).

If design infra was installed, point at the design loop's first move: explore a
moodboard, then run `setup-design-foundations` to settle the token ramps **before
the first screen is approved** — `prototype-to-design` reconciles screens against
foundations; it doesn't design them. `ask-argo` maps the rest of the route.
