# argo

A Turborepo monorepo whose `argo-skills` package holds Argo's own agent skills and a
one-command scaffolder that installs them — plus a curated third-party
[skills](https://github.com/vercel-labs/skills) bundle — into any project.

## Layout

```
packages/argo-skills/
  skills/            Argo's own skills — one SKILL.md folder each
  bundle.json        the manifest: third-party `bundle` + own `mine`
  bin/scaffold.mjs   installs every bundle source via `npx skills add`
skills-lock.json     committed record of the installed bundle (dogfooded into this repo)
```

## Scaffold a project — one command, no install

From inside any project, run it straight from GitHub. No npm publish, nothing to install
first — installs Argo's own skills **and** the third-party bundle for Claude Code or any
other agent:

```bash
npx github:milad-alizadeh/argo             # the single command that does it all
npx github:milad-alizadeh/argo --dry-run   # preview
```

Or, from a checkout of this repo:

```bash
bun run scaffold
```

Under the hood it runs the `argo-skills` scaffolder, which reads `bundle.json` and fans
out `npx skills add` for each source. Edit the bundle in
[`packages/argo-skills/bundle.json`](packages/argo-skills/bundle.json).

## Dogfooding

This monorepo is itself a scaffold target: running `bun run scaffold` at the root installs
the whole bundle into this repo's `.agents/` / `.claude/` (gitignored) and records it in
the committed `skills-lock.json`, restorable anywhere with `npx skills experimental_install`.

## Dev

```bash
bun install
bun run lint
bun run test
```
