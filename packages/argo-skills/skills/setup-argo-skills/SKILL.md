---
name: setup-argo-skills
description: Bootstrap a project with the Argo skill bundle — installs the third-party skills and Argo's own skills defined in argo-skills' bundle.json. Run once when starting a new project.
disable-model-invocation: true
---

# Setup Argo Skills

Install the full Argo skill bundle into the current project so this and every other
agent has them available. This is the one command that pulls in both the third-party
skills and Argo's own skills.

## What it does

Runs the `argo-skills` scaffolder, which reads its `bundle.json` manifest and installs
every listed source via `npx skills add` — the third-party `bundle` entries
(e.g. `mattpocock/skills`, `vercel-labs/skills`) and the `mine` entries (Argo's own
skills under the package's `skills/`).

## Process

### 1. Run the scaffolder

From the root of the project you're setting up:

```bash
npx argo-skills                   # if published to npm
# or, from a local checkout of the argo monorepo:
node <path-to>/packages/argo-skills/bin/scaffold.mjs
# or, once pushed to GitHub:
npx github:<owner>/argo --workspace argo-skills
```

Preview first with `--dry-run`. Use `-g` to install globally instead of per-project.

### 2. Confirm

After it runs, the skills are installed under the project's `.claude/skills/` (and
`.agents/skills/` for other agents), and a `skills-lock.json` records the exact set so
`npx skills experimental_install` can restore it later.

### 3. Edit the bundle

To change what gets installed, edit `bundle.json` in the `argo-skills` package —
add sources under `bundle`, or drop new `SKILL.md` folders under the package's `skills/`
for Argo's own.
