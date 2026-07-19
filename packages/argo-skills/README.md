# argo-skills

Argo's own skills, plus a one-command scaffolder that installs them **and** a curated
third-party bundle into any project — for Claude Code or any other agent.

## What it is

A thin resolver over [`npx skills`](https://github.com/vercel-labs/skills). `bundle.json`
is the multi-source manifest the `skills` CLI doesn't ship yet: it lists the third-party
sources plus Argo's own skills (kept in this package's `skills/`), and installs them all
at once.

## Project-agnostic by design — set up per project

This package is the **single source** for Argo's skills; it has no dependency on any
particular project (including the Argo cockpit app that shares this monorepo). Every
project — the cockpit and any other — is a plain **consumer**: it runs the scaffolder
to install its own copy of the skills under `.claude/skills/` (and `.agents/skills/`),
recorded in that project's `skills-lock.json`. Nothing here reaches into a consuming
app, and the installed skills carry everything they need with them:

- The scaffolder installs into the **current working directory**, so you point it at
  whatever project you're setting up.
- Each skill is **self-contained** — supporting files (e.g. `setup-rules/rules/*.md`)
  live inside the skill folder and travel with it on install, so a skill works the
  same in any project without reading back into this package.

The Argo cockpit's own `.claude/skills/` are therefore *installed output* of this
per-project flow, not source. The source is only ever here.

## Use it in a project

```bash
# from anywhere, inside the target project directory:
npx argo-skills            # once published, or `bun run scaffold` from the monorepo
```

Preview without touching anything:

```bash
argo-skills --dry-run
```

Options: `--global`/`-g` (install to `~` instead of the project), `--project`/`-p`,
`--dry-run`/`-n`.

## The manifest — `bundle.json`

```json
{
  "agents": ["claude-code"],
  "scope": "project",
  "bundle": [
    { "source": "mattpocock/skills", "skills": "*" },
    { "source": "vercel-labs/skills", "skills": ["find-skills"] }
  ],
  "mine": [
    { "source": "./skills", "skills": "*" }
  ]
}
```

- **`bundle`** — third-party sources. `source` is anything `skills add` accepts
  (`owner/repo`, a full URL, a git spec). `skills` is `"*"` or a list of names.
- **`mine`** — Argo's own skills, kept in this package's `./skills/<name>/SKILL.md`.
- **`agents`** — which agents to install for (e.g. `claude-code`, `cursor`, `codex`).
- **`scope`** — `project` (default, committed with the repo) or `global`.

## Argo's own skills

Live under `skills/`, one `SKILL.md` per folder, and install via the `mine` entry.
Add more by dropping another folder here (with any supporting files colocated inside it).

- [`scaffold-project`](skills/scaffold-project/SKILL.md) — interactive scaffolder for a
  new project of any stack (interview → monorepo vs single → install the stack's LSP →
  lay out the folders).
- [`implement-fanout`](skills/implement-fanout/SKILL.md) — implement several independent
  tickets in parallel, each in its own git worktree via a subagent.
- [`setup-rules`](skills/setup-rules/SKILL.md) — install Argo's engineering rule set into
  a project, adapting every path to the detected structure. Its rule templates ship in
  its own `rules/` folder so it's self-contained per project.
