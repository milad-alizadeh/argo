# Argo

Monorepo for the Argo skills/plugin **and** the Argo cockpit app. Read by both Claude Code and Codex.

## Agent skills

- **Issue tracker** — Issues and PRDs live in GitHub Issues on `milad-alizadeh/argo`, via the
  `gh` CLI. See `docs/agents/issue-tracker.md`.
- **Triage labels** — five canonical triage roles, each label string equal to its name. See
  `docs/agents/triage-labels.md`.
- **Domain docs** — single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See
  `docs/agents/domain.md`. `CONTEXT.md` is imported below so the model is injected rather than
  left to a pointer a session may not follow; the reasoning *behind* each term lives in
  `docs/domain/rationale.md` — read that only when changing a term.

## Task tracking

Maintain a live to-do list for any task with **three or more distinct steps**, edits across
**multiple files**, or **a plan the user approved**. Claude Code: `TodoWrite`. Codex:
`update_plan`.

- Write the list **before the first edit**, not as a retrospective summary.
- Exactly **one** item `in_progress` at a time; mark it `completed` the moment it is done, not
  in a batch at the end.
- One item = one verifiable outcome. "Fix the bug" is a task; "read the file" is not.
- Keep single-step edits, lookups, and conversational turns off the list — a one-item list is
  noise, and a list nobody needed teaches the next session to ignore lists.

## Rules

House engineering rules live in `rules/`. Load the ones matching the files you
touch (each rule's `paths:` frontmatter states its scope):

- **All code, any language** — `engineering-principles.md`, `code-style.md`,
  `comments.md` (a comment is **one line** unless a future edit could make it false;
  nothing here is published, so `///` earns no more room than `//`),
  `file-structure.md`, `dependencies.md`
- **TypeScript** — also `typescript-style.md` (how TS spells `code-style.md`)
- **Swift** (`apps/macOS`) — also `swift-style.md` (how Swift spells it, SwiftUI included)
- **Tests** — also `testing.md`
- **UI work** — also `ui-components.md`, `design-system.md`, `designs.md`
- **Skill authoring** — also `skill-authoring.md` (any `SKILL.md`)

### Module boundaries

`apps/macOS`'s three layers — `ArgoEngine` ⊥ `ArgoUI` ⊥ the app target — are enforced by
`scripts/swift-boundaries.sh` (in `quality:swift`, on the `macos` CI job and in pre-commit).
Each edge is ADR-0022's layering and is checkable from imports and declarations alone, which is
why they are gates rather than review notes. The sharpest one: **exactly one file in `ArgoUI`
may read live Hub state** — the Hub → cockpit projection. Everything else takes a value.

The JS/TS half of this — an LLM-maintained `<workspace>/scripts/module-boundaries.json`
compiled by `dependency-cruiser.cjs` into public-entry-only rules, plus a `placement` block
driving three folder gates (ADR-0021) — **has no subject here since ADR-0023 retired the
Electron cockpit.** Its scripts stay in `scripts/`, ship to consumer projects via
`scaffold.mjs --hooks` and the `setup-module-boundaries` skill, and get rewired into `quality`
the day a TypeScript workspace returns. Dormant, not withdrawn.

### Quality gates

The arithmetic half of those rules is a build failure, not a review note — `bun run quality`
(biome + duplication + Swift), and every rule in it is an **error, never a warning**. Biome
carries every per-file cap (50 lines per function, cognitive complexity 15, 3 parameters, a
150-line file ceiling counting code lines only) and the escape-hatch bans (`any`, `@ts-ignore`,
`!`, nested ternaries); `jscpd` gates whole-tree duplication at 1% across Swift and JS alike.
`bun run quality:swift` (SwiftFormat in check mode, SwiftLint, package boundaries) needs a macOS
runner and so lives on the `macos` CI job rather than the default Linux ones, alongside the
build and the swift-testing suites. On Linux, CI runs biome, duplication and `test:hooks` —
which is now the only executable suite there. Pre-commit runs lint-staged: biome, then
SwiftFormat/SwiftLint/boundaries and the design-token gate over staged Swift.

`scripts/placement-guard.mjs` is a `PreToolUse(Write)` hook that DENIES an agent creating a new
file loose at a module root, before it exists. It guards the way IN only (`Write`, new files,
module roots) — a refactor moving files OUT of a root never trips it — and fails open on error.
It finds its map by walking ancestors, so with no module map in this tree it simply permits;
it stays wired because it is what consumers get.

Two caps have **no rule to enforce them here** and live in `rules/` prose only: `as`
assertions and exhaustive `switch` over a union.

When a gate fires, fix it or ratchet it — **never suppress it inline and never raise a global
cap.** Exemptions live in **three** files, each entry labelled **KIND** (permanent — the rule
doesn't apply to that category) or **RATCHET** (debt; the list may only shrink):

| File | Covers |
|---|---|
| `biome.jsonc` `overrides` | every lint cap, the line ceiling included |
| `.jscpd.json` `ignore` | duplication — reasons in `scripts/jscpd-ignore-reasons.txt`, one per glob |
| the map's `placement` block | the folder rules — `allow`/`ratchet`/`exclude`, each value its own reason |

The placement gates fail on a **stale** exemption too: an entry naming no file is deleted, not
left to re-authorise a future breach.

Two of these configs **fail open when commented**, which is why the reasons sit in sidecars and
why `quality:duplication` passes `--config .jscpd.json` explicitly — **keep that flag on the
command.** Never prove a change to either config by exit code alone. Details and the
verification recipe: `docs/agents/quality-gates.md`.

## Session isolation

Multiple agent sessions run against this repo concurrently. Implementation work (ticket
builds, any multi-file change) must **never** run in the shared main checkout: if your cwd is
the repo root rather than a path under `.claude/worktrees/`, enter a worktree first (Claude
Code: the `EnterWorktree` tool — this section is your standing instruction to use it,
**unprompted**; other harnesses: `git worktree add`) and commit to a ticket branch there.
Read-only work (review, triage, Q&A) may stay in the main checkout. Enforced mechanically: a
`CLAUDECODE`-gated `PreToolUse` hook (`scripts/worktree-guard.mjs`) blocks agent `Edit`/`Write`
to `apps/**` or `packages/**` from outside a worktree — doc, memory, and config edits stay free,
and the human workflow is never touched.

Everything else about worktrees — naming format, resuming an interrupted worktree, recovering a
deleted one, and the sub-agent-in-parent-worktree rule — lives in `docs/agents/worktrees.md` and
applies to **all** implementation work, not just `/implement` runs.

Landed worktrees are reaped by `bun run worktrees:gc` (`scripts/worktree-gc.sh`). It removes
only what is provably safe (PR merged, tree clean, nothing unpushed, untouched for 30 minutes);
everything else is reported and left alone. `--dry-run` reports without removing.

## Cross-CLI guardrail hooks

`hooks.json` (repo root) is the neutral SSOT for the four guardrail hooks (graphify-before-grep,
placement write guard, worktree edit guard, worktree-gc), projected per-harness. **Edit
`hooks.json`, then run `bun run hooks:sync`** — it regenerates `.claude/settings.json` and
`.codex/hooks.json`; never hand-edit those blocks. Consumers opt in via `scaffold.mjs --hooks`,
and re-scope the edit guard to their own layout with `worktreeGuard.roots` in the same file.

A hook the sync does not recognise as its own is preserved as the consumer's and a fresh copy
appended, so **a script named in `hooks.json` must also be in `MANAGED_MARKERS`**
(`hooks-sync.mjs`) or the projection grows a duplicate on every run. `test:hooks` derives that
requirement rather than restating it.

## Skill bundle

A `/command` the user typed is **already loaded** — its instructions are in the turn. Follow them
directly; never call the `Skill` tool for it. Some skills (`implement`) refuse a model-issued
invocation outright, so the extra call is a rejected no-op rather than a second run.

The repo-root `skills-lock.json` is the bundle manifest **and** this repo's own install record.
`bun run scaffold` (= `npx github:milad-alizadeh/argo`) installs from it with one
`npx skills add` per source; `--skill a,b` installs a subset.

**Renaming or deleting a skill needs its old name in the lock's `retired` array**, or the old
copy stays installed and goes on advertising itself — two skills competing for the same prompts,
the retired one sometimes winning. `skills add` only ever adds, so removing the `skills` entry
uninstalls nothing. Retirement is an explicit list rather than "whatever the lock no longer
names" because nothing under a skills directory is git-tracked here, so absence cannot
distinguish a retired skill from one installed out of band (graphify ships its own). A name in
both lists fails the install rather than resolving silently.

The set is **deliberate** — a lock has no `"*"` wildcard. Add a skill with
`npx skills add <source> --skill <name>` and commit the lock; sweep a source with `--skill '*'`
and review the diff. Nothing appears on its own; the weekly `skills-drift` workflow reports what
showed up upstream. Editing one of Argo's own skills needs a push to `main` before a reinstall
sees it — the manifest installs from GitHub, not your checkout. Full workflow in
`packages/argo-skills/README.md`.

## Code review

An implement run reviews its diff before the PR opens. The review only works in a **fresh
context that never saw the author's reasoning**. Claude Code: `code-review` fans out parallel
axis sub-agents via the `Agent` tool. Other harnesses: run the review from a separate fresh
session over the diff.

If no independent fresh context is reachable, **stop and report that** — do not run the axes
yourself and present it as a review. Claude Code trap: agents spawned inside a `Workflow` have
no `Agent` tool, so run implement directly, not nested in a Workflow.

## graphify

Knowledge graph at `graphify-out/` with god nodes, community structure, and cross-file
relationships.

- For codebase questions, first run `graphify query "<question>"` when `graphify-out/graph.json`
  exists. `graphify path "<A>" "<B>"` for relationships, `graphify explain "<concept>"` for
  focused concepts. These return a scoped subgraph, far smaller than `GRAPH_REPORT.md` or grep.
- If `graphify-out/wiki/index.md` exists, use it for broad navigation over raw source browsing.
- Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review.

The graph is **code-only** (markdown excluded via `.graphifyignore`), committed, and refreshed
by the pre-commit hook — **never run `graphify update` by hand**, and **never run
`graphify label`** for upkeep (it re-clusters and drops dated backups). Wiring lives in the
`setup-graphify` skill.

## Design work

A UI ticket whose screen has a design in `docs/designs/` is built with **`design-to-code`**,
not `implement`. The design carries measurements the ticket's prose does not, so a screen built
without it drifts from what was agreed and nothing downstream can tell that drift from a bug.

The route in full — `/prototype` explores variants, `prototype-to-design` approves one and lands
it with a render, `design-to-code` builds it per ticket, `pixel-review` judges the pixels. This
is a **repo rule, not a skill description**: which tickets take the design route depends on what
is in `docs/designs/`, which no portable skill can know. `ask-argo` maps the rest.

## Visual verification

Nothing renders a view on CI, so **rendering is a thing YOU do**. Run `/pixel-review` for a
pixel- or spec-level check, and look at the affected states before calling a visual change done.

**Render whole app states** — `bun run screenshot --filter=@argo/macos -- <out.png>`, from the
repo root. Against an ordinary checkout this shows no Sessions, so it is the wrong tool for
looking at a surface you are building.
**Render one state in isolation** — the right one. From `apps/macOS`:
`ARGO_SPECIMEN=<case> sh scripts/screenshot.sh out.png`, or `--specimen <case>`;
`sh scripts/specimens.sh <dir> [name …]` for the set, and `ARGO_WINDOW_SIZE=<w>x<h>` when a
width is part of the state. Cases live in `ArgoUI/Specimen/SpecimenCatalog.swift`.
**Drive it like a user** — `sh scripts/e2e-test.sh`, also from `apps/macOS`. The only tests here
that click; every other Swift test builds a projection and asserts on it.

Two things that bite before you have read anything: a screenshot needs Screen Recording
permission or the PNG is silently blank, and **an e2e run holds the real keyboard and mouse for
its whole length — say so and wait before starting one**, because it takes the machine out from
under whoever is at it.

Everything else — why the script quits a running Argo, what the pixels are judged against, the
specimen harness in full: `docs/agents/visual-verification.md`.

## Tooling (RTK)

**Always prefix shell commands with `rtk`** so output is filtered before it reaches context. The
global Bash hook auto-wraps `git`, `grep`, `gh`, `vitest`, `tsc`, `ls`, `find` and similar — but
there is **no `bun` or `turbo` proxy**, so this repo's canonical entrypoints leak full output
unless wrapped explicitly:

```bash
rtk test bun run test               # turbo → swift-testing, failures only
rtk err  bun run format-and-lint    # biome at repo root (whole monorepo), errors only
rtk err  bun run quality:swift      # SwiftFormat --check, SwiftLint, package boundaries
```

There is no `typecheck` script any more — it ran `tsc` over `apps/desktop`, and no workspace
carries TypeScript sources to check (ADR-0023).

@CONTEXT.md
