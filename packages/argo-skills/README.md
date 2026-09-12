# argo-skills

Argo's own skills, and the manifest that bundles them with a curated third-party set for any
project, Claude Code or any other agent.

## What it is

Source, not a tool. The repo-root `skills-lock.json` enumerates every skill Argo bundles (the
third-party ones plus Argo's own, kept in this package's `skills/`), and the
[`skills`](https://github.com/vercel-labs/skills) CLI installs from it. This package used to ship
a scaffolder of its own; it is gone, and everything it did beyond the install is now written down
as steps in [`setup-argo-skills`](skills/setup-argo-skills/SKILL.md) for an agent to follow.

The one file left in `bin/` is `hooks-sync.mjs`, which projects the repo-root `hooks.json` into
each harness. It is not an installer.

## Project-agnostic by design — set up per project

This package is the **single source** for Argo's skills; it depends on no particular project,
including the cockpit app that shares this monorepo. Every project is a plain **consumer**: it
installs its own copy under `.claude/skills/` and `.agents/skills/`, recorded in that project's
`skills-lock.json`. Nothing here reaches into a consuming app, and each skill is **self-contained**
— supporting files such as `setup-quality-gates/templates/` live inside the skill folder and travel
with it, so a skill behaves the same in any project without reading back into this package.

The Argo cockpit's own `.claude/skills/` are therefore *installed output* of that per-project flow,
not source. The source is only ever here, and it distributes only via GitHub: even this monorepo
installs its own skills with the same command, so an edit to one of Argo's skills needs a push to
`main` before a reinstall sees it.

## Install, in a project

```bash
npx skills@latest add milad-alizadeh/argo
```

**Run it interactively and answer both questions.** It asks which agents to install for, and then
"Installation method". The second question is asked only when the chosen agents span more than one
skills directory, and answering it is what makes the CLI write
`.claude/skills/<name> -> ../../.agents/skills/<name>` itself. So pick claude-code **and** a
universal agent such as codex; passing `--yes` suppresses the question, and the symlinks it would
have built are then never built, so `.claude/skills/` stays empty.

That question is the whole reason a bespoke installer existed here. It no longer does, so the
answer is a human's or an agent's, every time.

Install a subset with `--skill`:

```bash
npx skills@latest add milad-alizadeh/argo --skill interface-review ship
```

Entries the target project locked itself are kept, so a subset install into a non-empty project
yields the union, not just the subset.

## Update

```bash
npx skills update --project --yes
```

`--yes` is safe here and it is not on the add path: update reads the installed agent set off disk
rather than asking, so Claude Code survives the refresh. It fetches each source's latest rather
than a pinned revision, because Argo's lock entries carry no `ref`.

## Everything the install does not do

Installing skills is all `skills add` does. The rest of a consumer's setup is prose in
[`setup-argo-skills`](skills/setup-argo-skills/SKILL.md), followed by an agent by hand: rescuing
the consumer's own skills from a name collision before they are overwritten, seeding
`.rtk/filters.toml`, copying `hooks.json` and the hooks it names and projecting them, adding the
`.gitignore` lines, and reporting what the always-on frontmatter now costs every turn.

The guardrail hooks are hand-work today because they are not in this package at all: `hooks/` sits
at the repository root, outside `packages/argo-skills/`, so `skills add` cannot carry them and
`skills update` cannot move them forward. [ADR-0036](../../docs/adr/0036-the-bundle-arrives-on-one-transport.md)
decides they move inside the bundle and arrive with it; that is #1810's work and is not built.

**What does not change when they do**: installing them stays a separate yes. They impose Argo's
worktree discipline on the project — the edit guard refuses an edit outside a worktree and the
reaper assumes `.claude/worktrees/` — and that is a decision a consuming project makes, not a side
effect of wanting the skills. See the repo root's `hooks.json` and AGENTS.md "Cross-CLI guardrail
hooks".

## The manifest — `skills-lock.json`

The repo-root `skills-lock.json` is the bundle. It is a standard vercel `skills` lock —
`{ version, skills: { <name>: { source, sourceType, skillPath, computedHash } } }` — which makes it
simultaneously the manifest Argo ships and the install record of Argo's own `.agents/skills/`. One
file, no second format to keep in sync, and `skills list` / `skills update` work against it
unchanged.

It is **not a version pin.** Entries carry no `ref`, so a restore installs whatever each source's
default branch holds today; `computedHash` is content identity, not a lock.

Nothing verifies the manifest without installing from it. There is no dry run, and the install is
interactive, so an edit here is proved by running it in a checkout and reading what appeared under
`.claude/skills`, never by a diff, since neither skills directory is tracked.

### Add a bundled skill

Because the lock enumerates skills by name, adding one is an explicit act:

```bash
npx skills add mattpocock/skills --skill <name>   # writes the entry into skills-lock.json
git add skills-lock.json && git commit
```

Same for one of Argo's own — edit it under `skills/`, push to `main`, then reinstall.

`skills add` only adds. Renaming or deleting a skill therefore leaves the old copy installed:
delete it by hand from `.claude/skills/` and `.agents/skills/` as well as from the lock.

### Pick up newly-published upstream skills

Nothing arrives on its own — there is no `"*"` wildcard in a lock. To sweep a source for
everything it now publishes:

```bash
npx skills add mattpocock/skills --skill '*'   # re-resolves the whole source
git diff skills-lock.json                      # review what appeared, then commit
```

Sweeping is a decision you make when you want it; nothing watches upstream for you.

## Argo's own skills

Live under `skills/`, one `SKILL.md` per folder, and install from the `milad-alizadeh/argo` entries
in the manifest. Add more by dropping another folder here, with any supporting files colocated
inside it, pushing to `main`, then adding the name to the lock.

- [`setup-quality-gates`](skills/setup-quality-gates/SKILL.md) — resolves each mechanical
  intent (function length, complexity, parameter count, type escape hatches, duplication, dead
  exports, import boundaries, test hygiene) to a real rule in whatever linter the project already
  runs, as an error, wired to a script, pre-commit and CI; then writes the one page of prose no
  linter can check (`rules/house.md`).
- [`atlas-write`](skills/atlas-write/SKILL.md) — generate a Project Atlas: the real parts of
  a codebase found from its manifests and imports, each written as what is inside it, the
  edges among those, the edges that leave it, and a paragraph over all of that, every claim
  anchored to a `path:line`.
- [`atlas-review`](skills/atlas-review/SKILL.md) — fact-check an emitted atlas node against
  the code, in a context that never saw it written. Splits the node into claims, resolves
  every anchor, settles each relation at a call site, and marks each `true`, `false` or
  `cannot tell`. It reports and never edits.
- [`interface-review`](skills/interface-review/SKILL.md) reviews accessibility, interaction,
  required states, and consistency with the project's tokens and components in the live UI.

### Provenance

`setup-quality-gates`' house rules and gate list
were shaped by the tenet set at [prickles.org](https://prickles.org) (Lewis, A., 2026 —
CC BY-NC 4.0). The tenets there are the map of what's worth enforcing; the prose here is
Argo's own, in Argo's forbidden-list voice.
