---
name: setup-graphify
description: Make graphify plug-and-play in the current repo. Installs graphify latest, installs the graphify skill + CLAUDE.md integration, and wires a single custom pre-commit hook that keeps a COMMITTED knowledge graph fresh and auto-names new communities — replacing graphify's stock async hooks. Project-agnostic; run once per repo.
disable-model-invocation: true
---

# Setup Graphify

One command to make graphify **committed, self-naming, and forget-about-it** in any repo.
graphify's own tooling does most of the work through its official channels; this skill
adds exactly one thing of its own — a custom pre-commit hook — and removes graphify's stock
async hooks in its place.

**The design (why the custom hook):** graphify's stock hook is *post-commit* and *detached*,
so it produces a graph that is never in the commit and always one step stale — the opposite
of a committed graph. So we drop it and instead do everything in **pre-commit**, where the
refreshed graph is staged *into* the same commit:

```
graphify update .          # refresh graph — AST only, fast, deterministic
git add graphify-out       # → the fresh, named graph rides INSIDE this commit
```

Two commands, no LLM, no key, no background process, no lag. `graphify update` **also names
communities** (deterministically, from each community's dominant node), so the committed graph
is always named — nothing async to wait on.

**Why not LLM naming in the hook?** `graphify label` gives *thematic* names, but it re-clusters
and writes a dated backup snapshot on **every** call (churn), needs an API key/backend, and its
`--missing-only` mode is a no-op anyway because `update` already leaves no `Community N`
placeholders. LLM naming is therefore an *occasional, in-session* polish (the graphify skill's
"Label communities" step) — deliberately kept out of the per-commit path.

## 1. Install / upgrade graphify

Prefer `uv` (graphify ships as the `graphifyy` package); fall back to pipx, then pip:

```bash
uv tool install graphifyy       # or: uv tool upgrade graphifyy
# fallbacks: pipx install graphifyy   |   pip install --user graphifyy
graphify --version              # confirm it's on PATH
```

## 2. Install the graphify skill + agent integration (official channels)

```bash
graphify install                # copies the graphify skill into the agent config dir(s)
graphify claude install         # writes the `## graphify` section into this repo's CLAUDE.md
```

`graphify claude install` also registers graphify's read/search PreToolUse guards in the
repo's local (gitignored) `.claude/settings.json` — that's local machine setup, not part of
any commit.

## 3. Replace graphify's stock hooks with ours

```bash
graphify hook uninstall         # remove graphify's async post-commit/post-checkout hooks
```

Then install the pre-commit block from `templates/graphify-precommit-block.sh` (colocated
with this SKILL.md). **Detect the repo's hook manager:**

- **Husky** (a `.husky/` dir exists): append the block to `.husky/pre-commit` (create it if
  absent). Husky owns `core.hooksPath`, so this is where git will find it.
- **Plain git** (no husky): append the block to `.git/hooks/pre-commit`, creating it with a
  `#!/bin/sh` shebang and `chmod +x` if it doesn't exist. Preserve any existing hook body.

Never write both. If husky is present, the `.git/hooks/` copy would be shadowed and dead.

The block is a safe no-op until a graph exists, so ordering vs other pre-commit steps
(lint-staged, etc.) doesn't matter — put it after them.

## 4. Keep the graph light in git

Add to `.gitignore` (create the entries if missing):

```gitignore
graphify-out/graph.html
graphify-out/cache/
```

Commit the rest — `graph.json`, `.graphify_labels.json`, `.graphify_analysis.json`,
`GRAPH_REPORT.md`, `manifest.json`. `git add graphify-out` in the hook honors these ignores,
so the 100KB+ interactive `graph.html` never bloats a diff.

## 5. Seed the graph once

The pre-commit only acts once `graphify-out/graph.json` exists, so build it a first time:

```bash
graphify extract . --code-only      # fast, no API key; communities start as placeholders
# or a full labeled build:  run the graphify skill  →  /graphify .
```

`graphify update`/`extract` names the communities deterministically as it builds, so the seed
is already named — no placeholder pass needed. Commit the seeded `graphify-out/` so the graph
is shared from the start.

## 6. Report

Tell the user: graphify version installed, that CLAUDE.md integration is in place, that the
stock hooks were replaced by the custom pre-commit (and where it was installed — `.husky/` vs
`.git/hooks/`), what was gitignored, and how the loop behaves: the graph is refreshed and
committed on every commit, with communities named deterministically — nothing to do by hand.
Mention that thematic LLM names are an optional in-session polish, never per-commit.
