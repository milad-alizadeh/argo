# Quality gates — exemptions and the fail-open traps

Companion to `AGENTS.md` → *Quality gates*. That section carries the rule; this one carries where
an exemption goes, the forensics behind the config that **fails silently open**, and how to prove a
change to it.

## What runs where

One place, and it is CI. `.github/workflows/ci.yml` runs four steps on `ubuntu-latest`:

- `bun run format-and-lint` — biome, `--error-on-warnings`.
- `bun run quality:types` — `turbo run typecheck`, because biome does not read types (#1733).
- `bun run quality:duplication` — jscpd, whole-tree, because a linter reads one file at a time.
- `bun run test:hooks` — every `scripts/*.test.mjs`, discovered from the directory.

Nothing runs at push time. `.husky/pre-commit` still runs lint-staged; `.husky/pre-push` is gone.

`bun run quality` locally is the Node pin, biome and duplication, in that order. CI does not run
`quality:node` as a step of its own — the pin reaches CI through `node-version-file:` and the
root `preinstall`, so a mismatch fails the install rather than a gate.

## What used to be here, and why it is not (#1758)

Most of this file described `scripts/swift-gate.sh` and the machinery it needed: the verdict cache
keyed on the Swift tree, the machine-wide build-slot lock, the package-scope narrowing, the
two-phase timing split, the `ARGO_GATE_CALLER` column and `bun run gate:report`. All of it is
deleted, along with `apps/macOS/scripts`, because `apps/macOS` is deprecated in favour of the
Electron app and there is no Swift tree left worth gating.

Two things worth carrying forward when `apps/desktop` needs a gate of its own, because both were
learned the expensive way:

- **A gate is priced per tree, and a review changes the tree.** Verifying before the review buys
  bytes nobody ships.
- **A ratio gate passes by dilution.** jscpd goes green when un-cloned lines are added around a
  clone, so read the clone count, not the percentage.

The cost premise that started it, that a `macos-26` CI job "billed about 99% of this repo's Actions
spend", was a misreading of the gross column. The billed column was $0. See the header of
`.github/workflows/ci.yml`.

## What covers `apps/desktop`, and what does not (#1733)

The Electron workspace arrived with #1773 and inherited most of its gates for free: `biome.jsonc`
includes `**`, so every cap and every escape-hatch ban already read it, and `quality:duplication`
already scans `apps`. The scaffold passes them. What it did not inherit was a typecheck and a
renderer boundary, and both are wired now.

`.jscpd.json` ignores `dist`, `out` and `build` but not `.vite`, where Forge's Vite plugin writes.
Only `apps/desktop/.gitignore` plus jscpd's `gitignore: true` keeps a packaged bundle out of the
duplication scan, so `.vite/**` is in the ignore list now, beside the other three, rather than
resting on a nested ignore file two tools deep.

- **Nothing type-checked it.** `apps/desktop` landed with a `typecheck` script and no caller, and
  biome does not read types, so a file `tsc` rejects passed `bun run quality` and passed CI.
  `quality:types` is `turbo run typecheck`, in `bun run quality` and in `ci.yml`. It is
  deliberately **not** in lint-staged: that hook is staged-files-only, and a type error is a
  property of the whole program.

  `scripts/typecheck-gate.test.mjs` is what stops it going quiet, and its header carries the
  reason. One trap worth keeping even though its tripwire is gone: `turbo.json` carries no
  comments. Turbo reads JSONC, but a `//` line in that file used to fail `test:hooks` with
  `Expected double-quoted property name in JSON`, because `scripts/gate-env.test.mjs` parsed it
  with `JSON.parse` at three call sites. #1758 deleted that suite along with the rest of the Swift
  gate, so nothing reads `turbo.json` from a suite today and a comment would now pass. The file
  stays comment-free by convention rather than by enforcement.
- **Nothing held the renderer boundary.** `src/preload.ts` states the rule in a comment — the
  renderer gets one narrow named surface and never Node — and no gate enforced it. A renderer file
  importing `electron` or `node:fs` passed everything. That is a security line, not a cap, because
  #1763 turns on the renderer never holding a token. It is now a `noRestrictedImports` override
  scoped to `apps/desktop/src/renderer/**`, and it reads `import type` as well, which matters
  because compilation erases a type-only import and the reach across the boundary would otherwise
  be invisible. The preload and the main process are deliberately out of scope: importing
  `electron` is their job.

  The rule alone is thinner than it looks, so two things stand behind it, and the review that
  found the holes is why they are here. **`tsconfig.web.json` sets `"types": []`.** Without it the
  renderer inherits every package in the root `@types`, `node` among them, and
  `process.env.SOME_TOKEN` type-checks clean in the one process that must never hold a token — no
  import statement for a specifier rule to see. **`scripts/typecheck-gate.test.mjs` asserts
  `contextIsolation: true` and `nodeIntegration: false` in `src/main.ts`.** Those two values are
  what make any Node reach from the renderer inert at runtime, and a one-word edit to either used
  to pass every gate in the repository. `sandbox` stays `false` and is deliberately not asserted:
  the preload needs it, and changing it is a behaviour decision rather than a gate.

Three intents from `setup-quality-gates` are **deferred**, each for a reason rather than an
oversight:

| Intent | Verdict | Why |
|---|---|---|
| Dead public surface (`knip`) | deferred | A new tool with its own config and a first-run ratchet. The workspace is four source files behind one preload bridge, so the gate would guard almost nothing today and the ratchet would be written against a tree about to be replaced. |
| Import cycles and real layering (`dependency-cruiser`) | deferred | The biome override is **specifier spelling in one directory**, and that is all it is. It refuses two names and four glob groups, and one hop of indirection still walks through: a renderer file importing `../preload`, which itself imports `electron`, draws no diagnostic and pulls `electron` into the renderer bundle. Nothing reads the import graph, so cycles are unguarded too. The `"types": []` and the runtime assertions above are what actually stand behind the rule; a graph tool is the honest fix and wants its own ticket. |
| Focused or skipped tests | n/a | `check-harness.mjs` has no focus or skip mechanism to ban — no `only`, no `skip` — and `apps/desktop` has no suite of its own yet. Nothing to gate until one of those changes. |

Two more pieces of #1733 turned out not to belong in a commit at all.

**The Node pin was split out of #1733 and is #1777**, whose section follows. It was split because
merging it stops `bun install` on any machine not on
24.20.0 — which is the pin working, not a defect — and the machine it was found on runs v22.10.0,
below Electron 44's own floor of 22.12.0. A change to every contributor's setup earns its own
deliberate merge.

**The skill bundle is a property of a checkout, not of a commit.** `bun run scaffold` installs into
`.claude/skills`, which this repository does not track, so running it inside a worktree changes
nothing a pull request can carry. The manifest was verified instead: `bun run scaffold --dry-run`
resolves 37 skills from 5 sources and exits 0. Run the real install in the checkout you work in,
never expecting it in a diff.

The packaged acceptance test, `apps/desktop/scripts/prove-packaged-pty.mjs`, needs a Mac, a full
Forge package and several minutes, so no local gate runs it. It now has a home: the
`desktop-artifact` job on `macos-26` in `.github/workflows/ci.yml`, free on the standard runner as
#1758 established, gated on a path filter that fails closed. What it cannot cover is signing — #1771 has chosen the
entitlement set but `osxSign` is not wired to it, and a re-signature can invalidate what the
package proved, so `assert:packaged` has to run again after it once that lands.

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
  the acceptance test is documented as `bun run prove:pty` and the Electron installer as
  `bun run install:electron`: the bare `node` spellings of both reach Forge and `@electron/get`
  ungated, and no manifest check can see a command that is only in a README.

Four traps worth holding. The first two are proved by running the gate
(`scripts/node-version-gate.test.mjs`); the third and fourth are read off the manifests
(`node-version-pin.test.mjs`, `node-version-source.test.mjs`), because they are properties of the
wiring rather than of the gate:

- **Never let Bun run the gate.** Bun's `process.versions.node` is a compatibility number, not the
  machine's Node: bun 1.3.13 reports 24.3.0 where `node -v` says v22.10.0. So a Bun-run gate
  answers a question nobody asked, and while it usually refuses by accident — the compat number is
  not the pin — pin the repo to 24.3.0 and it exits 0 on a machine with no Node at all. #1751
  records the Forge commands being run by hand on exactly 24.3.0, so that is a shape, not a
  hypothetical. The suite's case pins the sandbox to Bun's own number, so deleting the guard fails
  it on the exit status and not only on the message.
- **A missing `.node-version` is a refusal, not a skip.** Deleting the pin reads as "no pin" to
  every tool that consumes it, and that is the fail-open shape this file exists for.
- **Launching the gate is not gating.** `node …gate.mjs || true` and `node …gate.mjs ; next` both
  run it and carry on past its refusal. The wiring check anchors both ends — the gate is the first
  command, and what follows is `&&` or nothing. The first version of it matched only the
  invocation, and passed on a tree where a wrong Node did not fail the install.
- **The version is written in exactly one place**, and the checks for that are about *shape*, not
  about the current value. No `engines.node` in any workspace manifest, no `.nvmrc`,
  `.tool-versions` or `mise.toml`, no `volta` block — `actions/setup-node` prefers volta's version
  over `node-version-file`, so that one would outrank the pin on CI — and no hard-coded
  `node-version:` in any workflow or composite action. Grepping for the pinned string cannot hold
  this rule, because the duplicate that bites is the one forgotten when the pin **moves**, and a
  forgotten copy holds the old value while the grep hunts the new one: that check went green with
  `.node-version` at 24.21.0 and an `engines.node` of 24.20.0 in the root manifest. It is kept as
  a weak extra, named for what it is.

The exactness is deliberate: a newer patch does not pass until the repository updates the file.
A range's failure mode is "works on my machine, at a patch nobody else has", which is what the
pin closes.

**nvm does not read `.node-version`** — it reads `.nvmrc`, and has no fallback. `fnm` reads
`.node-version`, but installs nothing, so it needs `fnm install` first. `asdf` reads it **only**
with `legacy_version_file = yes` in `~/.asdfrc`; by default it ignores the file entirely. So on
nvm and on a default asdf the pin is enforced but not applied, and switching is manual:
`nvm install "$(cat .node-version)" && nvm use "$(cat .node-version)"`. Adding a `.nvmrc` to fix
that would break the single-source rule above — and `node-version-source.test.mjs` now refuses
one — which is why this is documented rather than solved.

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

