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

Three properties of the wiring are not readable off those files:

- **Each of biome and jscpd reads a different amount of the tree.** Biome reads one file at a
  time and cannot see a clone spanning two, so biome alone leaves a duplication breach for CI.
  Biome also does not read types, which is why the typecheck is a step of its own (#1733).
- **Nothing runs at push time.** `.husky/pre-commit` runs lint-staged; `.husky/pre-push` is gone.
- **CI never runs `quality:node`.** The pin reaches CI through `node-version-file:` and the root
  `preinstall`, so a mismatch fails the install rather than a gate, and the failure names the
  install rather than the Node.

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

**The typecheck is a step of its own and is not in lint-staged.** Biome does not read types, so a
file `tsc` rejects passes biome. lint-staged is staged-files-only, and a type error is a property
of the whole program rather than of a file, so it belongs in `quality` and in CI instead.
**Nothing asserts that `quality:types` is still wired into either**, so a step dropped from
`package.json` or `ci.yml` is caught by review or not at all.

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

## The Node pin, and why it is a `preinstall` (#1777)

`.node-version` at the root pins Node **exactly**, and `scripts/node-version-gate.mjs` is what
refuses anything else. It is not that file's only reader — `actions/setup-node` reads it too, via
`node-version-file: .node-version` in the shared setup action, which is how CI installs the pin
instead of agreeing with it by coincidence. *Single source* means one place it is **written**.

The callers: root `preinstall`, `quality:node` as `quality`'s first step, `install:electron`, and
every `apps/desktop` command that reaches Electron or Forge.

`preinstall` is the load-bearing one, and it is the only lifecycle hook bun runs at the root at
all. It makes a wrong Node a failed `bun install` rather than a failure further along that says
nothing about the Node — Electron 44's installer is CommonJS requiring an ESM-only
`@electron/get`, so an older Node gets `ERR_REQUIRE_ESM` and no clue.

**`preinstall` does not run before the install, whatever its name says.** Measured on bun 1.3.13:
a dependency's own `postinstall` fires about 40ms *before* the root `preinstall`, `Saved lockfile`
is already printed, and `node_modules` is fully linked when the gate finally speaks. So the gate
buys a non-zero exit, not an install that never happened, and the difference is not academic —
`node-pty`'s `install` script (`node scripts/prebuild.js || node-gyp rebuild`) has by then
compiled it against the wrong Node's ABI. **After switching Node, delete `node_modules` and
install again.** A second install that goes green over that tree proves nothing about it.

Three shapes get past the hook entirely, all of them knowingly accepted:

- `bun install --ignore-scripts` skips every lifecycle script there is.
- `bun pm trust <pkg>` runs that dependency's `install`/`postinstall` — the node-pty native build
  among them — with no root lifecycle at all.
  `docs/research/2026-09-08-packaged-electron-toolchain-proof.md` recommends exactly that command,
  so this is a real path rather than a theoretical one.
- Any command run as `node …` directly rather than through its `package.json` script. That is why
  the acceptance test is documented as `bun run prove:pty` (in `apps/desktop`) and the Electron
  installer as `bun run install:electron`: the bare `node` spellings of both reach Forge and
  `@electron/get` ungated, and no manifest check can see a command that is only in a README.

Four traps worth holding. **Nothing tests any of them** — `scripts/node-version-gate.mjs` has no
suite, and neither does the wiring — so each is a thing to check by hand or in review:

- **Never let Bun run the gate.** Bun's `process.versions.node` is a compatibility number, not the
  machine's Node: bun 1.3.13 reports 24.3.0 where `node -v` says v22.10.0. So a Bun-run gate
  answers a question nobody asked, and while it usually refuses by accident — the compat number is
  not the pin — pin the repo to 24.3.0 and it exits 0 on a machine with no Node at all. #1751
  records the Forge commands being run by hand on exactly 24.3.0, so that is a shape, not a
  hypothetical.
- **A missing `.node-version` is a refusal, not a skip.** Deleting the pin reads as "no pin" to
  every tool that consumes it, and that is the fail-open shape this file exists for.
- **Launching the gate is not gating.** `node …gate.mjs || true` and `node …gate.mjs ; next` both
  run it and carry on past its refusal. Reading a script for the invocation alone is not enough:
  check both ends, that the gate is the first command and that what follows it is `&&` or nothing.
- **The version is written in exactly one place**, and what to check is *shape*, not the current
  value. No `engines.node` in any workspace manifest, no `.nvmrc`, `.tool-versions` or
  `mise.toml`, no `volta` block — `actions/setup-node` prefers volta's version over
  `node-version-file`, so that one would outrank the pin on CI — and no hard-coded `node-version:`
  in any workflow or composite action. **Grepping for the pinned string cannot hold this rule**,
  because the duplicate that bites is the one forgotten when the pin *moves*, and a forgotten copy
  holds the old value while the grep hunts the new one. Grep for the *shape* instead: the key
  names above, wherever they appear.

The exactness is deliberate: a newer patch does not pass until the repository updates the file.
A range's failure mode is "works on my machine, at a patch nobody else has", which is what the
pin closes.

**nvm does not read `.node-version`** — it reads `.nvmrc`, and has no fallback. `fnm` reads
`.node-version`, but installs nothing, so it needs `fnm install` first. `asdf` reads it **only**
with `legacy_version_file = yes` in `~/.asdfrc`; by default it ignores the file entirely. So on
nvm and on a default asdf the pin is enforced but not applied, and switching is manual:
`nvm install "$(cat .node-version)" && nvm use "$(cat .node-version)"`. Adding a `.nvmrc` to fix
that would break the single-source rule above, which is why this is documented rather than solved.

## Where an exemption goes

Exemptions live in **two** files, each entry labelled **KIND** (permanent — the rule doesn't
apply to that category) or **RATCHET** (debt; the list may only shrink):

| File | Covers |
|---|---|
| `biome.jsonc` `overrides` | every lint cap, the line ceiling included |
| `.jscpd.json` `ignore` | duplication — reasons in `scripts/jscpd-ignore-reasons.txt`, one per glob |

Two rules have no linter and live in `rules/house.md` prose only: a cast standing in for a
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

