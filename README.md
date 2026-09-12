# argo

A Turborepo monorepo whose `argo-skills` package holds Argo's own agent skills and the seed
assets they install, alongside a curated third-party
[skills](https://github.com/vercel-labs/skills) bundle.

## Layout

```
packages/argo-skills/   the project-AGNOSTIC source of Argo's skills (the toolkit)
  skills/               Argo's own skills — one SKILL.md folder each, supporting
                        files (e.g. setup-quality-gates/templates/) colocated so each is self-contained
  assets/               seeds a consumer copies in, e.g. rtk-filters.toml
  bin/hooks-sync.mjs    projects hooks.json into each harness (`bun run hooks:sync`)
apps/                   consumers (e.g. the cockpit app) — set up per project, not source
skills-lock.json        the bundle manifest — every skill by name, third-party and own
                        (also this repo's own install record; dogfooded)
```

The `argo-skills` package is the single source; everything else — the cockpit app, and
any other project — is a **consumer** that installs the skills per project (see
Dogfooding below). Nothing in the package depends on a consuming app.

## Install the skills into a project

There is no bespoke installer. Install and update with the stock `skills` CLI, from the
project root:

```bash
npx skills@latest add milad-alizadeh/argo   # install
npx skills update --project --yes           # update to the latest published skills
```

Everything that used to surround those calls — the hooks opt-in, the RTK seed, the owned-skill
protection — is prose in
[`packages/argo-skills/skills/setup-argo-skills/SKILL.md`](packages/argo-skills/skills/setup-argo-skills/SKILL.md),
which an agent follows. Edit the bundle in [`skills-lock.json`](skills-lock.json) — see
[`packages/argo-skills/README.md`](packages/argo-skills/README.md) for how to add a skill or
sweep a source for newly-published ones.

## Dogfooding

This monorepo is itself an install target: running the two commands above at the root installs
the whole bundle into this repo's `.agents/` / `.claude/` (gitignored). The manifest they read
and rewrite *is* this repo's own lock, so the file is both the bundle definition and the install
record.

## Dev

**Use Node 24 or newer.** The root `package.json` declares it in `engines`, and CI runs the
version in `.node-version`. nvm reads `.nvmrc` rather than `.node-version`, so to match CI, name
the version explicitly:

```bash
nvm install "$(cat .node-version)" && nvm use "$(cat .node-version)"
```

After you switch Node's major version, delete `node_modules` and install again: `node-pty` is a
native addon built for one Node ABI. More in
[`docs/agents/quality-gates.md`](docs/agents/quality-gates.md).

```bash
bun install
bun run lint
bun run test
```
