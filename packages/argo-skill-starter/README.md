# argo-skill-starter

One command to install your agent-skill bundle — third-party skills **and** your own —
into any project, for Claude Code or any other agent.

## What it is

A thin resolver over [`npx skills`](https://github.com/vercel-labs/skills). `bundle.json`
is the multi-source manifest the `skills` CLI doesn't ship yet: list every source you
want (from any repo), plus your own skills under `./skills`, and install them all at once.

## Use it in a new project

```bash
# from anywhere, inside the target project directory:
npx argo-skill-starter            # once published, or via `bun run scaffold` in this repo
```

Preview without touching anything:

```bash
argo-skill-starter --dry-run
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
    { "source": "../../skills", "skills": "*" }
  ]
}
```

- **`bundle`** — third-party sources. `source` is anything `skills add` accepts
  (`owner/repo`, a full URL, a git spec). `skills` is `"*"` or a list of names.
- **`mine`** — your own skills, kept at the **repo-root `skills/`** (`skills/<name>/SKILL.md`).
  That location is agent-agnostic: `npx skills add <this-repo>` discovers them with no manifest.
- **`agents`** — which agents to install for (e.g. `claude-code`, `cursor`, `codex`).
- **`scope`** — `project` (default, committed with the repo) or `global`.

## Add your own skill

Drop a folder under the repo-root `skills/` with a `SKILL.md` (see `skills/example-house-style`).
It installs automatically via the `mine` entry, and is discoverable directly with
`npx skills add <this-repo>` — no Claude-specific manifest, works for any agent.
