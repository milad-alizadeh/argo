---
name: setup-graphify
description: Make graphify plug-and-play in the current repo. Installs graphify latest, wires its agent integration through the official channels, and sets up a self-maintaining committed knowledge graph — refreshed inside every commit, communities named deterministically (no LLM, no key), code-only, and conflict-free across worktrees/PRs. Project-agnostic and agent-agnostic. Usually dispatched by the /setup-argo-skills wizard; run directly to (re)install just this piece.
disable-model-invocation: true
---

# Setup Graphify

One command to make graphify **committed, self-naming, and forget-about-it** in any repo,
under whatever coding agent is running it. graphify's own tooling does the heavy lifting
through its official channels; this skill adds exactly one custom piece — a worktree-guarded
pre-commit refresh — and wires graphify's union merge driver so the committed graph never
conflicts.

**The model.** The graph is a property of the **integrated (main) codebase**, committed to git:

- **Refreshed in-commit, main-tree only.** A pre-commit hook runs `graphify update .` and stages
  `graphify-out/` — so the fresh graph rides *inside* the commit. It's **guarded to skip linked
  worktrees** (`git-dir != git-common-dir`), so feature branches never churn the graph or fight
  over it on merge.
- **Named deterministically — no LLM, no namer, no `Community N`.** `graphify update` names every
  community from its **dominant node** — a brand-new community gets a real name like `net.py`, never
  a numeric placeholder — with no API key, no backend, no agent coupling. Thematic LLM names
  (`graphify label`, or `--backend claude-cli` inside Claude Code for a keyless local run) are an
  **occasional manual polish only** — never automate them: each run re-clusters, drops a dated backup
  dir, and drifts wording, so always eyeball the result.
- **Code-only.** A `.graphifyignore` keeps markdown (plans, ADRs, skills, docs) out of the graph,
  so queries stay about code.
- **Conflict-free.** graphify's **union merge driver** auto-merges `graph.json`, so parallel
  commits never leave conflict markers.

No post-commit hook, no SessionStart hook, nothing agent-specific in the refresh path.

## 1. Install / upgrade graphify (>=0.9.15)

Install latest (>=0.9.15 is where `update` keeps community names instead of stripping them to
numeric IDs):

```bash
uv tool install graphifyy        # or: uv tool upgrade graphifyy
# fallbacks: pipx install graphifyy | pip install --user graphifyy
graphify --version               # confirm >= 0.9.15 and on PATH
```

## 2. Install the agent integration (official channels, agent-agnostic)

graphify ships an installer per agent — run the one(s) matching whatever this repo targets, and
graphify writes the correct instructions + query-first hooks for each. Do **not** hardcode one
agent:

```bash
graphify install                 # copies the graphify skill into the agent config dir(s)
graphify claude install          # Claude Code  → CLAUDE.md + PreToolUse hooks
graphify codex install           # Codex        → AGENTS.md
# also available: gemini | cursor | copilot | vscode | aider | opencode | … (see `graphify --help`)
```

A repo read by more than one agent (e.g. `CLAUDE.md` importing `AGENTS.md`) should run each
relevant installer.

## 3. Wire the pre-commit refresh (NOT graphify's stock post-commit)

Do **not** run `graphify hook install` for the rebuild. Its hook is **post-commit** (the fresh
graph lands *after* the commit, always one step stale) and, under husky (`core.hooksPath`), git
never runs `.git/hooks/*` at all — so the stock hook is silently dead. Instead install the block
from `templates/graphify-precommit-block.sh` (worktree-guarded `update` + stage). Detect the hook
manager:

- **Husky** (`.husky/` exists): append the block to `.husky/pre-commit`.
- **Plain git**: append to `.git/hooks/pre-commit` (create with `#!/bin/sh` + `chmod +x`,
  preserving any existing body).

The block is a no-op until the graph exists, so ordering vs lint-staged etc. doesn't matter.

## 4. Keep the graph code-only — adapted to this repo

Copy `templates/graphifyignore` → `.graphifyignore` (committed), then **adapt it to the harness
this repo actually uses** — the graph should be about application/library code, not agent config,
skills, rules, docs, or tooling. This is the **update-safe** lever: `--code-only` on `extract` is
ignored by `update` (which re-adds the excluded files on the next commit), but both `extract` and
`update` honor `.graphifyignore`.

Keep an ignore line only for a dir that exists here:

- **Always** `*.md` (plans, ADRs, instruction files `CLAUDE.md`/`AGENTS.md`, skill/rule prose).
- **Agent / editor / CI config present** — `.claude/`, `.codex/`, `.cursor/`, `.husky/`,
  `.github/`, `.agents/`.
- **Tooling + agent-facing definitions** — `scripts/`, a `rules/` dir, and any skills package
  (e.g. `packages/<skills-pkg>/`).

Widen for other non-code (fixtures, snapshots) as needed; delete a line to let that content back
into the graph.

## 5. Wire the union merge driver

`graphify merge-driver` is graphify's built-in union merge for `graph.json`. `graphify hook install`
would register it (git config + `.gitattributes`), but §3 skips that installer (it bundles the
driver with the dead post-commit hooks), so wire the driver standalone instead.

Copy the `graphify-out/graph.json merge=graphify` line into `.gitattributes` (committed), and set
the driver in each clone's git config (setup does this; the git-config half doesn't travel with the
repo, so the skill notes it for teammates):

```bash
git config merge.graphify.name   "graphify union merge"
git config merge.graphify.driver "graphify merge-driver %O %A %B"
```

## 6. Commit the graph, ignore only the cache

Add exactly one line to `.gitignore`:

```gitignore
graphify-out/cache/     # internal rebuild cache — regenerable, would churn every commit
```

Commit everything else in `graphify-out/` — `graph.json`, `graph.html`, `GRAPH_REPORT.md`,
`manifest.json`, `.graphify_labels.json`. (`update` creates no dated backup dirs to exclude.)

## 7. Seed the graph once, then commit

The pre-commit only acts once a graph exists, so build it a first time with graphify's own
commands (never hand-edit `graphify-out/`) — `extract` builds it respecting the ignore, `update`
names communities from their dominant node and writes `GRAPH_REPORT.md`:

```bash
graphify extract . --code-only   # AST-only, no key; .graphifyignore prunes non-code
graphify update .                # deterministic community names + report/html
```

Then commit `graphify-out/`.

## 8. Report

Tell the user: graphify version, which agent integration(s) were installed, and the loop — graph
refreshed and committed on every main-tree commit (skipped in worktrees), communities named
deterministically from their dominant node (no LLM/key/namer), markdown excluded, `graph.json`
union-merged so it never conflicts. Note the merge driver's git-config line must be set per clone
(teammates run it, or re-run this skill).
