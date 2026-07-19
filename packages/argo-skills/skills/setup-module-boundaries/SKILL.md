---
name: setup-module-boundaries
description: Install a mechanical module-boundary checker into a project so a leak fails the build instead of relying on review. An LLM builds and maintains a module map (module → public entry) for this repo; dependency-cruiser turns it into public-entry-only lint rules, wired into a package script and CI. Run once per repo, then re-run to refresh the map when structure changes.
disable-model-invocation: true
---

# Setup Module Boundaries

Make information hiding **enforced, not aspirational**. The rule this installs:

> A file outside module M may import M **only through M's public entry** (its barrel).
> M's internal files are private to M. A module's own files import each other freely.

This is the mechanical companion to the `file-structure.md` house rule's "enforce
mechanically where you can" clause. The semantic decision — *what the modules are and
where each one's front door is* — is an LLM judgment captured in a map file. The
enforcement — *turning that map into lint rules* — is deterministic. Keep that seam:
**edit the map, never the generated config.**

Templates ship inside this skill at `templates/` (next to this `SKILL.md`):
`module-boundaries.json` (the map, annotated), `dependency-cruiser.cjs` (the generator —
copy verbatim), `module-boundaries.yml` (the CI job).

## 1. Detect the project shape

Look, don't assume. Gather:

- **Package manager + lockfile** — root `package.json` `packageManager`, which lockfile
  exists (`bun.lock`, `pnpm-lock.yaml`, `package-lock.json`). Drives the add command and
  the CI setup step.
- **Where TS/JS source lives** — a single `src/`, or workspaces (`packages/*`, `apps/*`).
  Read root `package.json` `workspaces`.
- **The `tsconfig.json`** dependency-cruiser should resolve against (path aliases live
  there). In a monorepo the checker runs **per workspace**, each with its own tsconfig —
  install one map + config per workspace that has real internal structure, not one at the
  root spanning everything.
- **Seed from graphify if present** — if `graphify-out/graph.json` exists, its detected
  communities are a strong first draft of the module list. Run `graphify query "what are
  the top-level modules and their entry points"` (or read the community report) and use it
  to propose modules. The graph is a hint; you still decide the public entry for each.

## 2. Build the module map (the LLM step — this is the whole point)

This is the part a linter can't do for you. Produce `module-boundaries.json` from the
template by reasoning about *this* repo:

1. **Enumerate modules.** A module is a folder that owns one domain and exposes an API —
   typically each `packages/<name>`, each `apps/<name>/src/<layer>` (Electron: `main`,
   `preload`, `renderer`), and each feature folder under those. Group by domain, not by
   file kind (never make `utils/`, `types/`, `schemas/` a module).
2. **Find each module's public entry.** Usually its `index.ts` barrel. If callers legitimately
   need more than one entry (e.g. a barrel plus a `routes.tsx`), list each — the map's
   `publicEntry` is an array. If a module has *no* barrel yet but should, note it: creating
   the barrel is part of drawing the boundary.
3. **Write anchored regexes.** `path` matches every file in the module (`^packages/core/`),
   `publicEntry` matches only the front-door file(s) (`^packages/core/src/index\\.ts$`).
   Paths are repo-relative POSIX.
4. **Directional layering (optional).** If some module must never depend on another *at
   all* (stricter than public-entry-only — e.g. an Electron `renderer` must never import the
   `main` process, a `core` layer must never import a feature), add it under `layers`.
   Leave `layers` empty otherwise.

Set `tsConfig` to the workspace tsconfig, and `exclude` to skip build/output/e2e dirs.

**A module map that lists one giant module, or points every public entry at `.*`, checks
nothing.** The map earns its keep only when the internal/public split is real. If the repo
genuinely has no internal structure worth protecting yet, say so and stop — don't install a
checker that can never fire.

## 3. Materialize the checker

Per workspace being protected:

1. Copy `templates/module-boundaries.json` → the workspace root and fill in the real map
   from step 2. Delete the `example-*` entries.
2. Copy `templates/dependency-cruiser.cjs` → `.dependency-cruiser.cjs` **verbatim** next to
   the map. It `require`s the map; you should never need to edit it. (If the map lives at a
   non-default path, adjust the one `require` line — that's the only permitted edit.)
3. Install the engine as a dev dependency:
   `<pm> add -D dependency-cruiser` (in the workspace).
4. Add a package script:
   `"boundaries": "depcruise --config .dependency-cruiser.cjs --ignore-known .dependency-cruiser-known-violations.json <src-dirs>"`
   where `<src-dirs>` is the source root(s) to scan (e.g. `src`). Add a root aggregate script
   if the repo uses turbo/nx (`turbo run boundaries`).

## 4. Baseline against reality — fix or grandfather, never loosen

Run `<pm> run boundaries` (drop `--ignore-known` for the first run). Every error is a real
leak. For each:

- **Fix it** — re-route the import through the module's public entry, adding the missing
  re-export to the barrel. This is the preferred outcome; it's usually a one-line import
  change.
- **Grandfather it** only if fixing now is out of scope. Generate a baseline of the current
  violations and commit it, so *new* leaks still fail while known ones are tracked:
  `depcruise --config .dependency-cruiser.cjs --output-type baseline <src-dirs> > .dependency-cruiser-known-violations.json`

Never widen a `path`/`publicEntry` regex to make an error disappear — that silently unlocks
the whole module. The baseline file is the *only* sanctioned escape hatch, and shrinking it
over time is the goal.

## 5. Wire CI

Copy `templates/module-boundaries.yml` → `.github/workflows/module-boundaries.yml`. Swap the
two `# {{SWAP_FOR_YOUR_PM}}` lines for the detected package manager's install step, set
`{{WORKSPACE_DIR}}` to the workspace being checked (e.g. `apps/desktop`, or `.` for a
single-package repo), and scope it with `paths:` if only one workspace is covered. A leak
then fails the check on every PR.

**depcruise needs a Node runtime (22 || 24 || >=26)** even in a bun/pnpm repo — it runs under
Node via its shebang, and bun's runtime fails its engine check. The template therefore adds
`actions/setup-node` and invokes `npx --no-install depcruise …` directly rather than through
`<pm> run boundaries`. Locally, run the `boundaries` script under a supported Node (a machine
on an odd/non-LTS Node like 23 must switch via nvm/fnm first).

Optionally add it to a pre-commit hook (if the repo uses husky/lint-staged from the
`setup-pre-commit` skill) so leaks are caught before push — but CI is the backstop that
can't be skipped.

## 6. Maintain the map (the "LLM maintains it" contract)

The map is only correct for the structure that existed when it was written. It must be
refreshed when modules are added, split, or renamed — that's an LLM task, not a linter one.
State this explicitly in the repo so future agents do it:

- Add a short **Module boundaries** note to `CLAUDE.md`/`AGENTS.md`: "Module boundaries are
  enforced from `module-boundaries.json` via `<pm> run boundaries`. When you add or split a
  module, update the map (new `path` + `publicEntry`) in the same change — re-run
  `setup-module-boundaries` to have it rebuilt from scratch if the structure shifted a lot."
- When a boundary check fails in CI because a *legitimately new* module isn't in the map yet,
  the fix is to add it to the map, not to disable the rule.

## 7. Report

Tell the user, per workspace: how many modules the map defines and their public entries, how
many leaks the first run found and which you **fixed** vs **grandfathered** (with the baseline
file path), the package script name, and that the CI job now gates PRs. Point them at
`module-boundaries.json` as the file to edit when the shape changes.
