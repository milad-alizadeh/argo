# argo-skills

Argo's own skills, plus a one-command scaffolder that installs them **and** a curated
third-party bundle into any project — for Claude Code or any other agent.

## What it is

A thin wrapper over [`npx skills`](https://github.com/vercel-labs/skills). The repo-root
`skills-lock.json` enumerates every skill Argo bundles — the third-party ones plus Argo's
own (kept in this package's `skills/`) — and the scaffolder installs them from it, one
`npx skills add` per source.

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
per-project flow, not source. The source is only ever here — and it distributes
only via GitHub: even this monorepo installs its own skills with the same npx
command (push first, then reinstall).

## Use it in a project

```bash
# from anywhere, inside the target project directory:
npx github:milad-alizadeh/argo   # canonical — installs straight from GitHub
# npx argo-skills                # once published to npm
```

Preview without touching anything:

```bash
argo-skills --dry-run
```

Install a subset instead of the whole bundle:

```bash
npx github:milad-alizadeh/argo --skill implement,code-review,tdd
```

Options: `--dry-run`/`-n`, `--skill <names>` (comma- or space-separated subset; default is
the whole manifest), `--hooks` (also install the guardrail hooks — see below).

`--global`/`-g` and `--project`/`-p` are **gone**: the manifest is a project lock, and
`skills add --global` writes a different lock format in a different place, which is a
second install path rather than an option on this one. Passing either flag exits with an
error rather than quietly installing project-scoped.

### Why not `skills experimental_install`

`skills experimental_install` reads the very same lock and would collapse the fan-out to a
single call. It is not used, for one reason: it hardcodes its agent list to
`getUniversalAgents()` — every agent whose skills directory is `.agents/skills`. Claude
Code's is `.claude/skills`, so it is not in that set and receives **nothing** (verified
against `skills@1.5.21`: a full `experimental_install` into an empty project produced 58
entries under `.agents/skills/` and no `.claude/` directory at all; `claude` 2.1.220 has no
`.agents/skills` code path). Passing `--agent` is the only way to reach Claude Code, and
`experimental_install` accepts no agent argument. The moment it does, the per-source loop in
`bin/scaffold.mjs` collapses into one call and nothing else changes.

The agent list therefore lives in `bin/scaffold.mjs` as `SKILL_AGENTS`; the vercel lock
format has nowhere to put it, which is why the old manifest's `agents` array had to move
into code. The hooks half has its own audience list in `hooks.json`'s `agents` key.

## Guardrail hooks (opt-in)

Skills are always installed; the **guardrail hooks are opt-in**, because they impose
Argo's worktree discipline on the project (the edit guard blocks `apps/`+`packages/`
edits outside a worktree, and the reaper assumes `.claude/worktrees/`). Add `--hooks` to
also install them:

```bash
npx github:milad-alizadeh/argo --hooks
```

That copies the neutral `hooks.json` descriptor plus the two scripts it invokes into the
target, then projects the descriptor into each agent listed in its own `agents` key:
`claude-code` → `.claude/settings.json`, `codex` → `.codex/hooks.json` (unknown agents are
skipped with a warning). One source of truth per hook, a thin per-harness registration. See
the repo's `hooks.json` and AGENTS.md "Cross-CLI guardrail hooks".

## The manifest — `skills-lock.json`

The repo-root `skills-lock.json` is the bundle. It is a standard vercel `skills` lock —
`{ version, skills: { <name>: { source, sourceType, skillPath, computedHash } } }` — which
means it is simultaneously the manifest Argo ships and the install record of Argo's own
`.agents/skills/`. One file, no second format to keep in sync, and `skills list` /
`skills update` work against it unchanged.

It is **not a version pin.** Entries carry no `ref`, so a restore installs whatever each
source's default branch holds today; `computedHash` is drift detection (what
`bin/skills-drift.mjs` reads), not a lock.

### Add a bundled skill

Because the lock enumerates skills by name, adding one is an explicit act:

```bash
npx skills add mattpocock/skills --skill <name>   # writes the entry into skills-lock.json
git add skills-lock.json && git commit
```

Same for one of Argo's own — edit it under `skills/`, push to `main`, then re-run the
installer (the `milad-alizadeh/argo` source installs from GitHub, not from your checkout).

### Pick up newly-published upstream skills

Nothing arrives on its own any more — there is no `"*"` wildcard in a lock. To sweep a
source for everything it now publishes:

```bash
npx skills add mattpocock/skills --skill '*'   # re-resolves the whole source
git diff skills-lock.json                      # review what appeared, then commit
```

The weekly `skills-drift` workflow reports new upstream skills for the sources it watches,
so this is a decision you get prompted for rather than one you have to remember.

## Argo's own skills

Live under `skills/`, one `SKILL.md` per folder, and install from the `milad-alizadeh/argo`
entries in the manifest. Add more by dropping another folder here (with any supporting files
colocated inside it), pushing to `main`, then adding the name to the lock.

- [`scaffold-project`](skills/scaffold-project/SKILL.md) — interactive scaffolder for a
  new project of any stack (interview → monorepo vs single → install the stack's LSP →
  lay out the folders).
- [`setup-rules`](skills/setup-rules/SKILL.md) — install Argo's engineering rule set into
  a project, adapting every path to the detected structure. Its rule templates ship in
  its own `rules/` folder so it's self-contained per project.
- [`setup-quality-gates`](skills/setup-quality-gates/SKILL.md) — the mechanical companion
  to `setup-rules`: resolves each cap (function length, complexity, parameter count, type
  escape hatches, duplication) to a real rule in whatever linter the project already runs,
  as an error, wired to a script, pre-commit and CI.

### Provenance

Several rules in `setup-rules/rules/` and the whole gate list in `setup-quality-gates`
were shaped by the tenet set at [prickles.org](https://prickles.org) (Lewis, A., 2026 —
CC BY-NC 4.0). The tenets there are the map of what's worth enforcing; the prose here is
Argo's own, in Argo's forbidden-list voice.
