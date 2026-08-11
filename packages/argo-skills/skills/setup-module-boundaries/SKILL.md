---
name: setup-module-boundaries
description: Install a mechanical module-boundary checker, so a leak fails the build instead of relying on review. Also refreshes the module map when structure changes.
disable-model-invocation: true
---

# Setup Module Boundaries

The rule this installs:

> A file outside module M may import M **only through M's public entry** (its barrel).
> M's internal files are private to M. A module's own files import each other freely.

This is the mechanical companion to the `file-structure.md` house rule. The semantic
decision — *what the modules are and where each one's front door is* — is an LLM judgment
in a map file; turning that map into lint rules is deterministic. Keep that seam:
**edit the map, never the generated config.**

The map also carries a second half — **where a file may live**, which no import linter can see
(§5).

Templates ship inside this skill at `templates/` (next to this `SKILL.md`):
`module-boundaries.json` (the map, annotated), `dependency-cruiser.cjs` (the generator —
copy verbatim), `module-boundaries.yml` (the CI job), and the four placement scripts
`module-map.mjs`, `root-files-check.mjs`, `kind-folder-check.mjs`, `earned-shared-check.mjs`
(also verbatim — `module-map.mjs` is the shared reader the other three import).

## 1. Detect the project shape

Read these off the repo, not from memory:

- **Package manager + lockfile** — root `package.json` `packageManager`, which lockfile
  exists (`bun.lock`, `pnpm-lock.yaml`, `package-lock.json`). Drives the add command and
  the CI setup step.
- **Where TS/JS source lives** — a single `src/`, or workspaces (`packages/*`, `apps/*`).
  Read root `package.json` `workspaces`.
- **The `tsconfig.json`** dependency-cruiser should resolve against (path aliases live
  there). In a monorepo the checker runs **per workspace**, each with its own tsconfig —
  install one map + config per workspace that has real internal structure, not one at the
  root spanning everything.
## 2. Build the module map (the LLM step — this is the whole point)

Produce `module-boundaries.json` from the
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

The config lives in a **`scripts/` folder inside the workspace** (`<workspace>/scripts/`), not
at the workspace root.
Per workspace being protected:

1. Create `<workspace>/scripts/` if absent. Copy `templates/module-boundaries.json` →
   `<workspace>/scripts/module-boundaries.json` and fill in the real map from step 2. Delete
   the `example-*` entries.
2. Copy `templates/dependency-cruiser.cjs` → `<workspace>/scripts/dependency-cruiser.cjs`
   **verbatim**. It `require`s `./module-boundaries.json` (colocated in the same `scripts/`
   folder) — you should never need to edit it.
3. Path conventions, because the config sits one level down in `scripts/`:
   - Run depcruise from the **workspace root** (cwd), scanning `src`. Then the map's
     `path`/`publicEntry` regexes (`^src/…`) and `tsConfig` (e.g. `tsconfig.json`) stay
     workspace-root-relative — depcruise resolves `tsConfig` and scan paths against the cwd,
     not the config's location. Only the `--config` path points into `scripts/`.
4. Install the engine as a dev dependency: `<pm> add -D dependency-cruiser` (from the repo
   root in a workspaces monorepo, targeting the workspace, so the single root lockfile stays
   authoritative).
5. Add a package script that runs under a supported runtime. depcruise needs Node semantics
   22/24/26; **bun satisfies this** (its `process.versions.node` is ≥24) — but only when bun
   *runs* depcruise, so force the bun runtime instead of letting the `node` shebang shell out
   to a stray system Node:
   `"boundaries": "bun --bun x depcruise --config scripts/dependency-cruiser.cjs src"`
   (npm/pnpm/yarn just use `depcruise --config scripts/dependency-cruiser.cjs src` — their
   node runtime already applies). Add a root aggregate script for turbo/nx (`turbo run
   boundaries`).

## 4. Baseline against reality — fix or grandfather, never loosen

Run `<pm> run boundaries` (drop `--ignore-known` for the first run). Every error is a real
leak. For each:

- **Fix it** — re-route the import through the module's public entry, adding the missing
  re-export to the barrel. This is the preferred outcome; it's usually a one-line import
  change.
- **Grandfather it** only if fixing now is out of scope. Generate a baseline of the current
  violations and commit it (in `scripts/`, beside the config), so *new* leaks still fail while
  known ones are tracked — then add `--ignore-known scripts/.dependency-cruiser-known-violations.json`
  to the `boundaries` script:
  `bun --bun x depcruise --config scripts/dependency-cruiser.cjs --output-type baseline src > scripts/.dependency-cruiser-known-violations.json`

Never widen a `path`/`publicEntry` regex to make an error disappear — that silently unlocks
the whole module. The baseline file is the *only* sanctioned escape hatch, and shrinking it
over time is the goal.

## 5. The half dependency-cruiser cannot see — placement

The boundary rule governs **edges**: who may import whom. It says nothing about where a file
*sits*, and that blindness is not a small gap. A module's own hook parked at that module's root
imports its module through the module's declared public entry, so **every edge is legal, the
cruiser exits 0, and the folder structure rots anyway**. There is no loud failure — which is why
this half has to be counted rather than reviewed.

Three gates compile from the same map, all shipped in `templates/`. Copy all four scripts into
the **repo-root** `scripts/` folder verbatim (not the workspace's — they take `--map` and can
gate several workspaces), and wire them into the `quality` script beside the linter:

```
"quality:placement:root":   "node scripts/root-files-check.mjs   --map <workspace>/scripts/module-boundaries.json",
"quality:placement:kind":   "node scripts/kind-folder-check.mjs  --map <workspace>/scripts/module-boundaries.json",
"quality:placement:shared": "node scripts/earned-shared-check.mjs --map <workspace>/scripts/module-boundaries.json"
```

**1. Root files (`placement.rootFiles`).** Each module declares what may sit loose at its root.
**The default is GUARDED: a module listed in `modules` with no `rootFiles` entry FAILS.** Do not
soften this to "unlisted means unchecked" — that is the exact bug the gate replaced. Its
predecessor guarded a single hardcoded path, so every module added afterwards inherited an
exemption nobody chose, and each one flattened: in Argo's own repo, 66 files across four modules,
while the one path the gate covered stayed clean the whole time. Adding a module costs one key.

Filling this block is a **judgement pass, not a transcription**. For each root file ask what
sub-domain owns it, and put the answer in the entry's reason so the ratchet doubles as the
migration plan ("belongs in `feed/` with the seven other `feed*` files"). Two tells do most of
the work: a shared filename prefix IS the folder name, and a wiring file (an IPC bridge, a
store-reading hook) that "has nowhere to live" means a sub-domain is missing, not that the root
is one.

Where that wiring lives is decided **per module, and one answer does not transfer**. A slice
architecture whose features are pure Views genuinely cannot hold a store read, so its wiring
hoists into one named folder the container alone calls. A process with no such constraint has the
opposite answer: each domain owns its own bridge and the root holds the entry alone. Copying the
first shape into the second module *without its reason* is a documented way to flatten a root.

**2. Kind folders (`placement.kindFolders`).** `utils/`, `types/`, `helpers/` and their kin,
banned by name.

**3. Earned shared (`placement.earnedShared`).** A symbol in the domain-aware shared tier that
only one module imports has not earned the tier. Counted per **symbol**, never per file — see the
template's comment for why a file-level graph proves nothing.

All three fail on a **stale exemption** too: an entry naming no file is a failure, not a no-op.
That is what makes "the list may only shrink" arithmetic — the commit that moves a file must
delete its entry, so an exemption can never outlive the debt it was written for.

Land these the way §4 lands the boundary rule: **gate first, red, then fix.** A gate that has
never failed is unproven, and the first red run is the only cheap proof that it bites. Record
today's breaches as `ratchet` entries; fix what is mechanical now.

### Optionally, one step earlier: deny the write

The gates run at `quality` time and (if the repo has hooks) at commit time. Both land *after* the
file exists, with imports already pointing at it. Argo also ships `scripts/placement-guard.mjs` —
a `PreToolUse(Write)` agent hook that denies creating a new file loose at a module root outright.
It is installed by `scaffold.mjs --hooks` rather than by this skill, shares `rootPattern` with the
gate so the two cannot disagree, and fails open on any error. Mention it in the report; it is the
difference between catching the mistake and preventing it.

## 6. Wire CI

Copy `templates/module-boundaries.yml` → `.github/workflows/module-boundaries.yml`. Swap the
`# {{SWAP_FOR_YOUR_PM}}` line for the detected package manager's setup + install, set
`{{WORKSPACE_DIR}}` to the workspace being checked (e.g. `apps/desktop`, or `.` for a
single-package repo), and scope it with `paths:` if only one workspace is covered. A leak
then fails the check on every PR.

Add the three placement gates as steps in the same job — they need no toolchain beyond the
Node/bun already there, and each must be its own step so a failure names which gate fired.

Optionally add both halves to a pre-commit hook (if the repo uses husky/lint-staged from the
`setup-pre-commit` skill) so leaks are caught before push — but CI is the backstop that
can't be skipped.

For **placement specifically, pre-commit is worth more than it looks**. The cost is not comparable to a
duplication detector: these glob `src/**` and compare basenames, well under a second. And the
timing is the substance — a misplaced file caught in CI becomes a follow-up ticket written after
the session that produced it has ended, while the same file caught at commit is fixed by whoever
still holds the context that produced it.

## 7. Maintain the map (the "LLM maintains it" contract)

The map is only correct for the structure that existed when it was written. It must be
refreshed when modules are added, split, or renamed — that's an LLM task, not a linter one.
State this explicitly in the repo so future agents do it:

- Add a short **Module boundaries** note to `CLAUDE.md`/`AGENTS.md`: "Module boundaries are
  enforced from `module-boundaries.json` via `<pm> run boundaries`. When you add or split a
  module, update the map (new `path` + `publicEntry`, **and a `placement.rootFiles` entry**) in
  the same change — re-run `setup-module-boundaries` to have it rebuilt from scratch if the
  structure shifted a lot."
- When a boundary check fails in CI because a *legitimately new* module isn't in the map yet,
  the fix is to add it to the map, not to disable the rule.
- **Say why a new module fails the placement gate before it has any files**, or the next agent
  will read that failure as a bug and "fix" it by making the default permissive. Adding a module
  costs one key.

**Do not write a rule in prose that one of these gates now enforces.** Prose that duplicates a gate competes for attention with every other line an agent reads,
while changing nothing — it was already being read and ignored before the gate existed. Cut the enforced paragraphs to a pointer naming
the gate, and move the reasoning into the gate's own failure message, where it is read at the
moment it applies rather than on every file touch. Keep in prose only what no glob can count:
which sub-domain a file belongs to, and why a wiring answer that is right for one module is
wrong for the next.

## 8. Report

Tell the user, per workspace: how many modules the map defines and their public entries, how
many leaks the first run found and which you **fixed** vs **grandfathered** (with the baseline
file path), the package script name, and that the CI job now gates PRs. Point them at
`module-boundaries.json` as the file to edit when the shape changes.

For the placement half (§5), four more, and the last two are the ones a reader cannot derive:

- **The starting breach count per gate**, which is the ratchet's baseline.
- **Whether you landed it red first** and it fired.
- **Which modules got an empty `rootFiles` entry because they have no files yet** — they are
  guarded from their first file, which is the point, and reads as an oversight if unstated.
- **Every ratchet entry whose stated destination was a guess.** Writing "belongs in `top-bar/`"
  off a filename rather than off the file's contents is easy and normal; the entry is still a
  claim the next agent will act on. Say which ones you read and which you inferred.
