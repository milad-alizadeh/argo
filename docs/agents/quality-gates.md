# Quality gates — exemptions and the fail-open traps

Companion to `AGENTS.md` → *Gates*. That section carries the rule; this one carries where
an exemption goes, the forensics behind the config that **fails silently open**, and how to prove a
change to it.

## What runs where

One place, and it is CI. **The step list lives in `.github/workflows/ci.yml` and the local subset
in `package.json`'s `quality` script; read them there.** A copy of either in this file is a
lookup that goes stale between the day a step is added and the day someone notices, which is how
this section came to promise "four steps" over a list of three, and to describe a `quality` that
had grown a typecheck.

Two properties of the wiring are not readable off those files:

- **Each of biome and jscpd reads a different amount of the tree.** Biome reads one file at a
  time and cannot see a clone spanning two, so biome alone leaves a duplication breach for CI.
  Biome also does not read types, which is why the typecheck is a step of its own (#1733).
- **Nothing runs at commit time either, and nothing at push time.** There is no git hook left:
  husky, lint-staged and `.husky/` are gone (#1911). The pre-commit hook had spent months calling
  a script #1828 deleted, so every commit failed on it and every session passed `--no-verify`,
  which skipped the lint it did carry as well. A staged-files subset of a check CI runs over the
  whole tree buys nothing and costs a gate that fails open the moment one flag is typed.

## What no config confesses

Two shapes cost this repo real time and apply to whatever gates `apps/desktop` next:

- **A gate is priced per tree, and a review changes the tree.** Verifying before the review buys
  bytes nobody ships, so the order is: focused checks while building, one review, every finding
  fixed in one batch, the final commit, then the full gate once on that committed tree.
- **A ratio gate passes by dilution.** jscpd goes green when un-cloned lines are added around a
  clone, so read the clone count, not the percentage.

## What covers `apps/desktop`, and what does not

`biome.jsonc` includes `**`, so every cap and every escape-hatch ban reads the Electron workspace
already, and `quality:duplication` scans `apps`. Three things sit outside that, and each is
thinner than it looks.

**The typecheck is a step of its own.** Biome does not read types, so a file `tsc` rejects passes
biome, and a type error is a property of the whole program rather than of a file. That is why it
lives in `quality` and in CI. **Nothing asserts that `quality:types` is still wired into either**,
so a step dropped from `package.json` or `ci.yml` is caught by review or not at all.

**`turbo.json` must carry no comments.** Turbo itself reads JSONC and would accept them; the file
stays comment-free by convention, with nothing enforcing it.

**The renderer boundary is specifier spelling in one directory, and that is all it is.** A
`noRestrictedImports` override scoped to `apps/desktop/src/renderer/**` refuses `electron` and
`node:*`, and it reads `import type` too, because compilation erases a type-only import and the
reach would otherwise be invisible. The preload and the main process are deliberately out of
scope: importing `electron` is their job. The limits worth knowing before trusting it:

- **One hop of indirection walks straight through.** A renderer file importing `../preload`,
  which itself imports `electron`, draws no diagnostic and pulls `electron` into the renderer
  bundle. Nothing reads the import graph, so cycles are unguarded too. A graph tool is the honest
  fix and wants its own ticket.
- **`tsconfig.web.json` sets `"types": []`**, and it is load-bearing. Without it the renderer
  inherits every package in the root `@types`, `node` among them, and `process.env.SOME_TOKEN`
  type-checks clean in the one process that must never hold a token, with no import statement for
  a specifier rule to see.
- **`contextIsolation: true` and `nodeIntegration: false` in `apps/desktop/src/main.ts` are
  asserted by nothing.** Those two values make any Node reach from the renderer inert at
  runtime, and a one-word edit to either passes every gate in the repository. `sandbox` stays `false` and is
  deliberately not asserted: the preload needs it, and changing it is a behaviour decision rather
  than a gate.

**`.jscpd.json` ignores `.vite` explicitly**, beside `dist`, `out` and `build`. A packaged bundle
would otherwise stay out of the duplication scan only through `apps/desktop/.gitignore` plus
jscpd's `gitignore: true`, which is a nested ignore file two tools deep.

## What no gate can reach

**The skill bundle is a property of a checkout, not of a commit.** The install writes
`.claude/skills` and `.agents/skills`, neither of which this repository tracks, so running it
inside a worktree changes nothing a pull request can carry. It is also interactive, and there is
no dry run, so a `skills-lock.json` edit is proved only by installing it by hand and reading what
appeared. **Treat a manifest change as unverified until someone has done that.**

**The packaged acceptance test needs a Mac and several minutes.** `apps/desktop/scripts/prove-packaged-pty.mjs`
runs in the `desktop-artifact` job on `macos-26`, behind a path filter that fails closed. What it
cannot cover is signing: a re-signature can invalidate what the package proved, so
`assert:packaged` has to run again after `osxSign` is wired to the chosen entitlement set.

## The Node version (#1951)

The root `package.json` sets the minimum in `engines.node` (`>=24`), and nothing enforces it: no
script checks the running Node. Below 24, Electron 44's installer dies with `ERR_REQUIRE_ESM`,
which names no version.

`.node-version` is the one place CI's Node is written. The shared setup action reads it through
`node-version-file: .node-version`, so a literal `node-version:` in a workflow is a second copy,
caught by review or not at all.

`node-pty` is a native addon built against one Node ABI, and the ABI changes with the major
version. After switching Node's major version, delete `node_modules` and install again.

nvm reads `.nvmrc` and not `.node-version`, so to run CI's version locally name it:
`nvm install "$(cat .node-version)" && nvm use "$(cat .node-version)"`.

## Where an exemption goes

Exemptions live in **two** files, each entry labelled **KIND** (permanent — the rule doesn't
apply to that category) or **RATCHET** (debt; the list may only shrink):

| File | Covers |
|---|---|
| `biome.jsonc` `overrides` | every lint cap, the line ceiling included |
| `.jscpd.json` `ignore` | duplication — reasons in `scripts/jscpd-ignore-reasons.txt`, one per glob |

Two rules have no linter and live in `AGENTS.md` prose only: a cast standing in for a
check, and the exhaustive construct over a closed set.

## Why the exemption reasons live in sidecars

**Biome silently checks zero files if `biome.json` holds a comment.** Hence `biome.jsonc` — the
overrides are annotated inline, and the `.jsonc` extension is what makes that legal.

**jscpd's auto-discovery silently skips the entire `.jscpd.json` if that file holds a comment**
(you get no threshold and a larger file count, with no error), and JSON is its only config
format. Hence the sidecar `scripts/jscpd-ignore-reasons.txt`, one reason per ignore glob.

## Why `--config .jscpd.json` is load-bearing

`quality:duplication` passes **`--config .jscpd.json` explicitly**. An explicitly-named config is
*parsed* rather than *discovered*, so a malformed one prints

```
config file .jscpd.json line 1: expected value
```

and exits non-zero, instead of quietly running unconfigured. **Dropping that flag restores the
fail-open.**

## Never prove the config by exit code

`jscpd … -t 0` exits **1 in both states** on this repo:

| State | Result |
|---|---|
| healthy | 1 clone in 211 files |
| silently unconfigured | 16 clones in 312 files |

The exit code cannot tell them apart — **the analysed file count is the only signal.**

Prove a config change by effect, one of:

1. Check the **analysed file count** still excludes the ignored paths.
2. Plant a throwaway clone pair inside an ignored path and another outside; confirm only the
   outside pair is reported.

