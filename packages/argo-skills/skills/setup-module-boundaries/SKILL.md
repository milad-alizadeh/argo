---
name: setup-module-boundaries
description: Install public-entry-only import rules and file-placement gates compiled from one module map (dependency-cruiser plus three placement scripts); re-run to refresh the map after a restructure.
disable-model-invocation: true
---

# Setup Module Boundaries

The rule this installs: a file outside module M imports M **only through M's public entry**;
M's internal files are private to M. The semantic decision, what the modules are and where
each front door is, is a judgement in a map file; turning the map into lint rules is
deterministic. **Edit the map, never the generated config.** The map also carries where a file
may live (§5), which no import linter can see.

Templates ship at `templates/`: `module-boundaries.json` (the map), `dependency-cruiser.cjs`
(the generator, copied verbatim), `module-boundaries.yml` (the CI job), and the placement
scripts `module-map.mjs`, `root-files-check.mjs`, `kind-folder-check.mjs`,
`earned-shared-check.mjs` (verbatim; `module-map.mjs` is the shared reader).

## 1. Detect the project shape

Write down the package manager and lockfile, every workspace holding a `tsconfig.json`, and
each workspace's source root. In a monorepo the checker runs per workspace with its own map
and config, never one map at the root spanning everything.

## 2. Build the module map

Produce `module-boundaries.json` from the template by reasoning about this repo:

1. **Enumerate modules.** A module is a folder that owns one domain and exposes an API: each
   `packages/<name>`, each `apps/<name>/src/<layer>` (`server`, `client`), each feature folder
   under those. Group by domain, never by kind (`utils/`, `types/` are not modules).
2. **Find each module's public entry**, usually its barrel; list each if callers need more
   than one. A module with no barrel that should have one gets it as part of the boundary.
3. **Write anchored regexes.** `path` matches every file in the module (`^packages/core/`),
   `publicEntry` only the front door (`^packages/core/src/index\\.ts$`), repo-relative POSIX.
4. **Directional layering**, only where one module must never import another at all (a
   `core` layer never imports a feature; a `client` never imports `server`); else leave
   `layers` empty.

Set `tsConfig` and `exclude`. **A map that lists one giant module, or points every public entry
at `.*`, checks nothing**; if the repo has no internal structure worth protecting yet, say so
and stop.

Done when every source file matches exactly one module's `path` (`root-files-check`'s orphan
list is the test) and every `publicEntry` regex matches an existing file.

## 3. Materialize the checker

Per protected workspace: copy the filled map and `dependency-cruiser.cjs` into
`<workspace>/scripts/`; install `dependency-cruiser` as a dev dependency from the repo root;
add a `boundaries` script. Run depcruise from the workspace root scanning `src`, since it
resolves `tsConfig` and scan paths against the cwd, not the config's location; only
`--config` points into `scripts/`. Under bun, force its runtime (`bun --bun x depcruise …`)
so the `node` shebang cannot shell out to a stray system Node. Add a root aggregate for the
monorepo runner.

Done when `<pm> run boundaries` runs and prints rule names, not a config error.

## 4. Baseline against reality

Every error on the first run is a real leak. Fix it by re-routing the import through the
public entry, adding the missing re-export to the barrel; or grandfather it into a committed
baseline (`--output-type baseline` → `scripts/.dependency-cruiser-known-violations.json`,
then `--ignore-known`). A new module goes into the map; the baseline is the only escape
hatch, and shrinking it is the goal.

Done when `boundaries` exits 0 with the baseline committed and the report lists fixed against
grandfathered counts.

## 5. Placement, the half the cruiser cannot see

A module's own file parked at that module's root imports through the public entry, every edge
legal, exit 0, structure rotting. Three gates compile from the same map. Copy the four scripts
into the repo-root `scripts/` verbatim (they take `--map` and can gate several workspaces) and
wire them into `quality` beside the linter:

```
"quality:placement:root":   "node scripts/root-files-check.mjs   --map <workspace>/scripts/module-boundaries.json",
"quality:placement:kind":   "node scripts/kind-folder-check.mjs  --map <workspace>/scripts/module-boundaries.json",
"quality:placement:shared": "node scripts/earned-shared-check.mjs --map <workspace>/scripts/module-boundaries.json"
```

- **Root files.** Each module declares what may sit loose at its root; a module in `modules`
  with no `rootFiles` entry FAILS, and a module with nothing to declare writes
  `{"allow": {}, "ratchet": {}}`. Filling the block is a judgement pass: for each root file
  ask what sub-domain owns it and put the answer in the entry's reason, so the ratchet
  doubles as the migration plan. A shared filename prefix is the folder name; a wiring file
  that "has nowhere to live" means a sub-domain is missing, and where wiring lives is decided
  per module.
- **Kind folders.** `utils/`, `types/`, `helpers/` and their kin, banned by name.
- **Earned shared.** A symbol in the shared tier that only one module imports has not earned
  the tier, counted per symbol, never per file.

All three fail on a stale exemption too, which is what makes "the list may only shrink"
arithmetic. Land them red first, then fix what is mechanical and record the rest as `ratchet`
entries with a destination folder each. Placement gates run in well under a second, so they
belong in pre-commit as well as CI. If the guardrail hooks are installed (`--hooks`),
`placement-guard.mjs` denies a loose root file at write time; say so in the report.

Done when all three gates exit 0, every `ratchet` entry names a destination folder, and the
first red output is in the report.

## 6. Wire CI

Copy `templates/module-boundaries.yml` into the workflows folder, swap the package-manager
setup line, set `{{WORKSPACE_DIR}}`, scope with `paths:` if one workspace is covered, and add
the three placement gates as separate steps so a failure names its gate. Append both halves to
the repo's existing pre-commit hook where one exists.

Done when a planted deep import fails the wired command and is removed.

## 7. Maintain the map

Add a **Module boundaries** note to the project doc: "Enforced from `module-boundaries.json`
via `<pm> run boundaries`. When you add or split a module, update the map (`path`,
`publicEntry`, and a `placement.rootFiles` entry) in the same change; a new module fails the
placement gate until it has its entry." Keep in prose only what no glob can count: which
sub-domain a file belongs to.

## 8. Report

Per workspace: modules and their public entries; leaks found, fixed against grandfathered,
the baseline path; the script name; CI wired. For placement: the starting breach count per
gate; that it landed red first and fired; which modules got an empty `rootFiles` entry; and
every ratchet entry whose destination was inferred from a filename rather than read from the
file.
