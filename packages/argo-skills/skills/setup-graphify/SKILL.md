---
name: setup-graphify
description: Make graphify plug-and-play in the current repo. Installs graphify latest, installs the graphify skill + CLAUDE.md/AGENTS.md integration, and wires a self-maintaining committed knowledge graph — refreshed in each commit, new communities auto-named, conflict-free across worktrees/PRs. Project-agnostic; run once per repo.
disable-model-invocation: true
---

# Setup Graphify

One command to make graphify **committed, self-naming, and forget-about-it** in any repo.
graphify's own tooling does the heavy lifting through its official channels; this skill adds
two small pieces of its own — a pre-commit refresh and a SessionStart auto-namer — and wires
graphify's union merge driver so the committed graph never conflicts.

**The model.** The graph is a property of the **integrated (main) codebase**, committed to git:
- **Refreshed in-commit, main-tree only.** A pre-commit hook runs `graphify update .` and stages
  `graphify-out/` — so the fresh graph rides *inside* the commit. It's **guarded to skip linked
  worktrees** (`git-dir != git-common-dir`), so feature branches never churn the graph or fight
  over it on merge.
- **Names preserved, new ones auto-named.** `graphify update` (>=0.9.15) keeps existing community
  names across rebuilds; brand-new communities appear as `Community N` and a **SessionStart hook**
  names just those with the local Claude CLI (`graphify label --missing-only`) — no metered key,
  no churn, no wipe.
- **Conflict-free.** graphify's **union merge driver** auto-merges `graph.json`, so parallel
  commits never leave conflict markers.

No post-commit hook anywhere. `graphify label` (full relabel) is never run automatically — it
re-clusters and churns; only `--missing-only` (new stubs) ever runs.

## 1. Install / upgrade graphify (>=0.9.15 required)

>=0.9.15 is the version where `update` stopped stripping community names back to numeric IDs —
below it, names silently reset on every rebuild. Install the latest:

```bash
uv tool install graphifyy        # or: uv tool upgrade graphifyy
# fallbacks: pipx install graphifyy | pip install --user graphifyy
graphify --version               # confirm >= 0.9.15 and on PATH
```

## 2. Install the skill + agent integration (official channels)

```bash
graphify install                 # copies the graphify skill into the agent config dir(s)
graphify claude install          # writes the graphify section into CLAUDE.md / AGENTS.md
```

## 3. Wire the pre-commit refresh (NOT graphify's stock post-commit)

Do **not** run `graphify hook install` for the rebuild — its hook is post-commit + async, so the
graph never lands in the commit, and it fires in worktrees. Instead install the block from
`templates/graphify-precommit-block.sh` (worktree-guarded `update` + stage). Detect the hook
manager:
- **Husky** (`.husky/` exists): append the block to `.husky/pre-commit`.
- **Plain git**: append to `.git/hooks/pre-commit` (create with `#!/bin/sh` + `chmod +x`,
  preserving any existing body).

The block is a no-op until the graph exists, so ordering vs lint-staged etc. doesn't matter.

## 4. Wire the SessionStart auto-namer

Copy `templates/graphify-name-communities.sh` → `scripts/graphify-name-communities.sh`
(`chmod +x`), and register it as a **SessionStart hook** in the agent's settings
(`.claude/settings.json` for Claude Code):

```json
{ "hooks": { "SessionStart": [ { "hooks": [
  { "type": "command", "command": "sh scripts/graphify-name-communities.sh" }
] } ] } }
```

It fires only when placeholder communities exist, names them via the local Claude CLI in the
background, and the names ride into your next commit.

## 5. Wire the union merge driver

Copy the `graphify-out/graph.json merge=graphify` line into `.gitattributes` (committed), and set
the driver in each clone's git config (setup does this; the skill notes it for teammates):

```bash
git config merge.graphify.name   "graphify union merge"
git config merge.graphify.driver "graphify merge-driver %O %A %B"
```

## 6. Commit the graph, ignore only the cache

Add exactly one line to `.gitignore`:

```gitignore
graphify-out/cache/     # internal rebuild cache — regenerable, would churn every commit
```

Commit everything else in `graphify-out/` — `graph.json`, **`graph.html`**, `GRAPH_REPORT.md`,
`manifest.json`, `.graphify_labels.json`. (With `update`-only there are no dated backup dirs to
worry about — those only come from `graphify label`, which we never run automatically.)

## 7. Seed the graph once, then commit

The pre-commit only acts once a graph exists, so build it a first time (`graphify extract .
--code-only`, or run the graphify skill for a labeled build), then commit `graphify-out/`.

## 8. Report

Tell the user: graphify version, that integration is in CLAUDE.md/AGENTS.md, and the loop —
graph refreshed and committed on every main-tree commit (skipped in worktrees), new communities
auto-named at session start, `graph.json` union-merged so it never conflicts. Note the merge
driver's git-config line must be set per clone (teammates run it, or re-run this skill).
