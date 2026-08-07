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

## Rules

House engineering rules live in `rules/`. Load the ones matching the files you
touch (each rule's `paths:` frontmatter states its scope):

- **All code, any language** — `engineering-principles.md`, `code-style.md`,
  `comments.md`, `file-structure.md`, `dependencies.md`
- **TypeScript** — also `typescript-style.md` (how TS spells `code-style.md`)
- **Swift** (`apps/macOS`) — also `swift-style.md` (how Swift spells it, SwiftUI included)
- **Tests** — also `testing.md`
- **UI work** — also `ui-components.md`, `design-system.md`, `design-studies.md`
- **Skill authoring** — also `skill-authoring.md` (any `SKILL.md`)

### Module boundaries

Import boundaries are enforced mechanically from an LLM-maintained map. Each protected
workspace has `<workspace>/scripts/module-boundaries.json` (the source of truth: module →
public entry) which `dependency-cruiser.cjs` compiles into public-entry-only lint rules —
**edit the map, never the generated `.cjs`**. Run `bun run boundaries` in the workspace (CI
gates it on every PR). When you add, split, or rename a module, update the map's `path` +
`publicEntry` in the **same change**; a new module missing from the map is fixed by adding it,
**never by loosening a regex**. `apps/desktop` locks Electron main ⊥ preload ⊥ renderer isolation.

That linter sees **edges only**, so the same map carries a `placement` block for the rules about
where a file may *live*. Three gates compile from it (`bun run quality:placement`): **every**
module declares what may sit loose at its root and a module with no entry FAILS (ADR-0021);
kind-folders (`utils/`, `types/`, `hooks/`, …) are banned outright; and a symbol in the
domain-aware shared tier needs more than one module to want it.

Where wiring lives is decided **per module and does not transfer**: renderer slices are pure
Views, so their store and bridge reads hoist into `cockpit/`; main has no such constraint, so
each of its domains owns its own bridge and its root is the entry alone.

### Quality gates

The arithmetic half of those rules is a build failure, not a review note — `bun run quality`
(biome + duplication + placement), and every rule in it is an **error, never a warning**. Biome
carries every per-file cap (50 lines per function, cognitive complexity 15, 3 parameters, a
150-line file ceiling counting code lines only) and the escape-hatch bans (`any`, `@ts-ignore`,
`!`, nested ternaries); `jscpd` gates whole-tree duplication at 1%; the three placement gates
above hold `file-structure.md`'s folder rules. CI runs all of them; pre-commit runs biome **and
placement**.

`scripts/placement-guard.mjs` is a `PreToolUse(Write)` hook that DENIES an agent creating a new
file loose at a module root, before it exists. It guards the way IN only (`Write`, new files,
module roots) — a refactor moving files OUT of a root never trips it — and fails open on error,
with the gate as backstop.

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

## Visual verification

Every Storybook story is rendered in CI (the `stories` job / `story tests` required check) as a
smoke test — it mounts each story in real Chromium and fails on anything that throws. There is
no pixel-baseline diffing. For a pixel- or spec-level check, run `/visual-verify` on demand.

**Rendering `apps/macOS`.** Swift has no Storybook, so the render method is the app itself:
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
state; the script reads the names out of the catalog rather than repeating them.

**Use it before claiming a visual change is done.** The app launched against an ordinary checkout
shows no Sessions, so without a specimen the surface being built is never actually looked at — and
the design decisions carry no measurements, so `docs/designs/`'s approved study is the only source
for rhythm, density and type size. Prose in the decision log can be satisfied while the approved
pixels are not.

## Tooling (RTK)

**Always prefix shell commands with `rtk`** so output is filtered before it reaches context. The
global Bash hook auto-wraps `git`, `grep`, `gh`, `vitest`, `tsc`, `ls`, `find` and similar — but
there is **no `bun` or `turbo` proxy**, so this repo's canonical entrypoints leak full output
unless wrapped explicitly:

```bash
rtk test bun run test               # turbo → vitest, failures only
rtk err  bun run format-and-lint    # biome at repo root (whole monorepo), errors only
rtk err  bun run typecheck
```

@CONTEXT.md
