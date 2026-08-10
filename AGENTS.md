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
  `comments.md`, `file-structure.md`, `dependencies.md`
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
`.codex/hooks.json`; never hand-edit those blocks. Consumers opt in via `scaffold.mjs --hooks`.

## Skill bundle

A `/command` the user typed is **already loaded** — its instructions are in the turn. Follow them
directly; never call the `Skill` tool for it. Some skills (`implement`) refuse a model-issued
invocation outright, so the extra call is a rejected no-op rather than a second run.

The repo-root `skills-lock.json` is the bundle manifest **and** this repo's own install record.
`bun run scaffold` (= `npx github:milad-alizadeh/argo`) installs from it with one
`npx skills add` per source; `--skill a,b` installs a subset.

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

There is no automated render check and no pixel-baseline diffing. The Storybook `stories` CI job
retired with the Electron cockpit (ADR-0023) — Swift has no Storybook, so nothing mounts a view
on a Linux runner. **Rendering is therefore a thing YOU do**, not something CI catches for you.
For a pixel- or spec-level check, run `/pixel-review` on demand.

**Rendering `apps/macOS`.** The render method is the app itself:
`bun run screenshot --filter=@argo/macos -- <out.png>` builds it, launches it, and captures the
WINDOW, not the screen. It quits any running Argo first, and that is **load-bearing**: `open` on
an already-running bundle id activates THAT instance, so a copy left up by another worktree
yields a plausible-looking screenshot of somebody else's tree. Screen Recording permission is
required the first time a terminal captures another process's window; without it the PNG is
blank.

That renders whole app states. For **one state in isolation**, the harness is
`ArgoUI/Specimen/SpecimenCatalog.swift`: a `Specimen` case per renderable state, launched by name
(`--specimen <case>`, or `ARGO_SPECIMEN=<case> sh scripts/screenshot.sh out.png`), with
`sh scripts/specimens.sh <dir> [name …]` rendering the set. Adding a case is all it takes to add a
state; the script reads the names out of the catalog rather than repeating them. A width is part of
the state for anything laid out in columns, so `ARGO_WINDOW_SIZE=<w>x<h>` renders the same case at
a chosen size — the narrow case is a render somebody else can repeat, not a window dragged by hand.

**Use it before claiming a visual change is done.** The app launched against an ordinary checkout
shows no Sessions, so without a specimen the surface being built is never actually looked at — and
the design decisions carry no measurements, so `docs/designs/cockpit-sessions-liquid-glass.png` is
the only source for rhythm, density and type size. Prose in the decision log can be satisfied while
the approved pixels are not. The rhythm itself lives in `ArgoUI/VisualContract/`, rendered by the
`foundations` specimen — that, not an HTML page, is the living token contract (`rules/design-system.md`).

**A render is not a click.** `apps/macOS` has one XCUITest target, `ArgoE2ETests` — the only tests
here that launch Argo and drive it. Every other Swift test is a SwiftPM package test that can build
a projection and assert on it but cannot click, so a view that renders correctly in a specimen and
comes apart inside a popover passes all of them. `sh scripts/e2e-test.sh`, from `apps/macOS`.

It is a **local** gate, deliberately not a CI one: driving the real app needs a macOS runner, the
most expensive minutes GitHub bills, on every push. Run it when you touch a surface that is only
reachable by clicking. Two things about it that are not obvious — the first run on a machine
answers a macOS authorisation prompt by hand and a sleeping display fails the same way; and a test
must launch onto a `--specimen`, never the machine's own registry, or it asserts whatever that Mac
happens to have on it.

That run drives the **real WindowServer**, so it holds the keyboard and mouse for its whole length —
there is no headless XCUITest to switch on. `sh scripts/e2e-vm.sh` gives it a screen that is not
yours instead, running the same suite inside a Tart VM synced from the current worktree
(`--provision` once per machine, headless every run after). Same gate, same tests; only the screen
changes.

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
