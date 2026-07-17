# argo-skills

Argo's own skills, plus a one-command scaffolder that installs them **and** a curated
third-party bundle into any project — for Claude Code or any other agent.

## What it is

A thin resolver over [`npx skills`](https://github.com/vercel-labs/skills). `bundle.json`
is the multi-source manifest the `skills` CLI doesn't ship yet: it lists the third-party
sources plus Argo's own skills (kept in this package's `skills/`), and installs them all
at once.

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
Currently one: [`scaffold-project`](skills/scaffold-project/SKILL.md) — an interactive
scaffolder for a new project of any stack (interview → monorepo vs single → install the
stack's LSP → lay out the folders). Add more by dropping another folder here.
