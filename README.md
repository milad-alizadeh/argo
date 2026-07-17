# argo

An agent-agnostic **skills** repo + a one-command scaffolder for bootstrapping new
projects with a curated bundle of [agent skills](https://github.com/vercel-labs/skills).

## Layout

```
skills/                       your own skills — SKILL.md per folder (agent-agnostic)
packages/argo-skill-starter/  the scaffolder tool + bundle.json manifest
```

## Two ways to use it

**As a skills source** — any agent, no Claude-specific manifest:

```bash
npx skills add milad-alizadeh/argo            # installs the skills in ./skills
npx skills add milad-alizadeh/argo --list     # preview
```

**As a scaffolder** — installs the third-party bundle *and* your own skills into a project
in one shot. Edit the bundle in [`packages/argo-skill-starter/bundle.json`](packages/argo-skill-starter/bundle.json):

```bash
bun run scaffold            # from this repo
# or the setup-argo-skills skill, which runs it for you
```

See [`packages/argo-skill-starter/README.md`](packages/argo-skill-starter/README.md) for details.

## Dev

```bash
bun install
bun run lint
bun run test
```
