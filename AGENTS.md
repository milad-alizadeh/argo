# Argo

Monorepo for the Argo skills/plugin **and** the Argo cockpit app. Read by both Claude Code and Codex.

## Agent skills

### Issue tracker

Issues and PRDs live in GitHub Issues on `milad-alizadeh/argo`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, each label string equal to its name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Rules

House engineering rules live in `rules/`. Load the ones matching the files you
touch (each rule's `paths:` frontmatter states its scope):

- **All code** — `engineering-principles.md`, `comments.md`, `file-structure.md`,
  `typescript-style.md`, `dependencies.md`
- **UI work** — also `ui-components.md`, `design-system.md`, `design-studies.md`
- **Skill authoring** — also `skill-authoring.md` (any `SKILL.md`)

### Module boundaries

Import boundaries are enforced mechanically from an LLM-maintained map. Each protected
workspace has `<workspace>/scripts/module-boundaries.json` (the source of truth: module →
public entry) which `dependency-cruiser.cjs` compiles into public-entry-only lint rules —
**edit the map, never the generated `.cjs`**. Run `bun run boundaries` in the workspace (CI
gates it on every PR). When you add, split, or rename a module, update the map's `path` +
`publicEntry` in the **same change**; a new module missing from the map is fixed by adding it,
never by loosening a regex. `apps/desktop` locks Electron main ⊥ preload ⊥ renderer isolation.

## Session isolation

Multiple agent sessions run against this repo concurrently. Implementation work (ticket
builds, any multi-file change) must **never** run in the shared main checkout: if your cwd is
the repo root rather than a path under `.claude/worktrees/`, enter a worktree first (Claude
Code: the `EnterWorktree` tool — this section is your standing instruction to use it,
unprompted; other harnesses: `git worktree add`) and commit to a ticket branch there.
Read-only work (review, triage, Q&A) may stay in the main checkout. This is enforced
mechanically: a `CLAUDECODE`-gated `PreToolUse` hook (`scripts/worktree-guard.mjs`) blocks agent
`Edit`/`Write` to `apps/**` or `packages/**` from outside a worktree — doc, memory, and config
edits stay free, and the human workflow is never touched.

Everything else about worktrees — the deterministic naming format, resuming an interrupted
worktree, recovering a deleted one, and the sub-agent-in-parent-worktree rule — lives in
`docs/agents/worktrees.md`, and applies to **all** implementation work, not just `/implement`
runs. That doc is self-contained and ships with the guardrail hooks, so a consumer
that installs `--hooks` gets the rules alongside the enforcement.

Landed worktrees are reaped by `bun run worktrees:gc` (`scripts/worktree-gc.sh`) — PRs merge
on GitHub, so nothing local fires when work lands and worktrees otherwise accumulate. It
removes only what is provably safe: PR merged (or branch merged into the default branch),
working tree clean, nothing unpushed, and untouched for 30 minutes so a live session isn't
pulled out from under it. Everything else is reported and left alone; `--dry-run` reports
without removing.

## Cross-CLI guardrail hooks

`hooks.json` (repo root) is the neutral SSOT for the three guardrail hooks (graphify-before-grep,
worktree edit guard, worktree-gc), projected per-harness like `bundle.json` projects skills.
**Edit `hooks.json`, then run `bun run hooks:sync`** — it regenerates `.claude/settings.json`
(claude-code) and `.codex/hooks.json` (codex); never hand-edit those blocks. Consumers get the
hooks opt-in via `scaffold.mjs --hooks`. Details in `hooks.json` and the code comments.

## Code review

An implement run reviews its diff before the PR opens (upstream `implement` calls the
`code-review` skill). The review only works in a **fresh context that never saw the author's
reasoning** — an author reviewing their own diff knows what the code *meant* to do, which is
exactly the knowledge that hides the defect. Claude Code: `code-review` fans out parallel axis
sub-agents via the `Agent` tool. Other harnesses without sub-agent spawning: run the review from
a separate fresh session over the diff (a new Codex/Cursor conversation).

If no independent fresh context is reachable, **stop and report that** — do not run the axes
yourself and present it as a review. One Claude Code trap: agents spawned inside a `Workflow`
have no `Agent` tool, so an implement run nested in a Workflow can't spawn its own review — run
implement directly (not inside a Workflow) so the review stage can fan out its sub-agents.

## graphify

This project has a knowledge graph at `graphify-out/` with god nodes, community
structure, and cross-file relationships.

- For codebase questions, first run `graphify query "<question>"` when
  `graphify-out/graph.json` exists. Use `graphify path "<A>" "<B>"` for
  relationships and `graphify explain "<concept>"` for focused concepts. These
  return a scoped subgraph, usually much smaller than `GRAPH_REPORT.md` or raw grep.
- If `graphify-out/wiki/index.md` exists, use it for broad navigation instead of
  raw source browsing.
- Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review or when
  query/path/explain do not surface enough context.

The graph is **code-only** (markdown — plans, ADRs, skills, docs — is excluded via
`.graphifyignore`), committed, and refreshed automatically by the pre-commit hook — you never
run `graphify update` by hand. Communities are named deterministically from their dominant
node; never run `graphify label` for upkeep (it re-clusters and drops dated backups). How it's
wired (worktree guard, merge driver) lives in the `setup-graphify` skill, not here.

## Visual verification

Every Storybook story is rendered in CI (the `stories` job / the `story tests` required check) as
a smoke test — it mounts each story in a real Chromium and fails on anything that throws, so a
broken story, a barrel sweep, or an MDX error reds the gate. There is no pixel-baseline diffing.
For a pixel- or spec-level visual check, run `/visual-verify` on demand: it renders the affected
states and has a fresh agent judge them against the spec.

## Tooling (RTK)

Run commands through `rtk` so output is filtered before it reaches context. The
global Bash hook already auto-wraps `git`, `grep`, `gh`, `vitest`, `tsc`, `ls`,
`find`, and similar — but it has **no `bun` or `turbo` proxy**, so this repo's
canonical entrypoints leak full output unless wrapped explicitly:

```bash
rtk test bun run test               # turbo → vitest, failures only
rtk err  bun run format-and-lint    # biome at repo root (whole monorepo), errors only
rtk err  bun run typecheck
```

@RTK.md
