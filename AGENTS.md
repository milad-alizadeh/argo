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
- **UI work** — also `ui-components.md`, `design-system.md`, `design-wireframes.md`

### Module boundaries

Import boundaries are enforced mechanically from an LLM-maintained map. Each protected
workspace has `<workspace>/scripts/module-boundaries.json` (the source of truth: module →
public entry) which `dependency-cruiser.cjs` compiles into public-entry-only lint rules —
**edit the map, never the generated `.cjs`**. Run `bun run boundaries` in the workspace (CI
gates it on every PR). When you add, split, or rename a module, update the map's `path` +
`publicEntry` in the **same change**; a new module missing from the map is fixed by adding it,
never by loosening a regex. `apps/desktop` locks Electron main ⊥ preload ⊥ renderer isolation.

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
