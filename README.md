# argo

A Turborepo monorepo whose `argo-skills` package holds Argo's own agent skills and a
one-command scaffolder that installs them — plus a curated third-party
[skills](https://github.com/vercel-labs/skills) bundle — into any project.

## Layout

```
packages/argo-skills/   the project-AGNOSTIC source of Argo's skills (the toolkit)
  skills/               Argo's own skills — one SKILL.md folder each, supporting
                        files (e.g. setup-quality-gates/templates/) colocated so each is self-contained
  bin/scaffold.mjs      installs the manifest with one `npx skills add` per source
apps/                   consumers (e.g. the cockpit app) — set up per project, not source
skills-lock.json        the bundle manifest — every skill by name, third-party and own
                        (also this repo's own install record; dogfooded)
```

The `argo-skills` package is the single source; everything else — the cockpit app, and
any other project — is a **consumer** that installs the skills per project (see
Dogfooding below). Nothing in the package depends on a consuming app.

## Scaffold a project — one command, no install

From inside any project, run it straight from GitHub. No npm publish, nothing to install
first — installs Argo's own skills **and** the third-party bundle for Claude Code or any
other agent:

```bash
npx github:milad-alizadeh/argo                    # the single command that does it all
npx github:milad-alizadeh/argo --dry-run          # preview
npx github:milad-alizadeh/argo --skill tdd,ship   # a subset of the bundle
```

Or, from a checkout of this repo:

```bash
bun run scaffold
```

Under the hood the `argo-skills` scaffolder reads the manifest and runs one
`npx skills add` per source, installing exactly the skills it names. Edit the bundle in
[`skills-lock.json`](skills-lock.json) — see
[`packages/argo-skills/README.md`](packages/argo-skills/README.md) for how to add a skill or
sweep a source for newly-published ones.

## Dogfooding

This monorepo is itself a scaffold target: running `bun run scaffold` at the root installs
the whole bundle into this repo's `.agents/` / `.claude/` (gitignored). The manifest it
installs from *is* this repo's own lock, so the file is both the bundle definition and the
install record, and the installer rewrites it with what it actually installed.

## Dev

```bash
bun install
bun run lint
bun run test
```
