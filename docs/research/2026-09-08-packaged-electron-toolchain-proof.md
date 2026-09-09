# The packaged Electron toolchain, proved against the real thing

**Date:** 2026-09-08 · **For:** [Prove the packaged Electron toolchain](https://github.com/milad-alizadeh/argo/issues/1743),
under the migration map [cross-platform Electron desktop migration](https://github.com/milad-alizadeh/argo/issues/1730)
and the toolchain choice [Choose the Electron desktop toolchain](https://github.com/milad-alizadeh/argo/issues/1732) ·
**Status:** the proof **failed**, at a cause the decision did not anticipate

## The answer

**No. Electron Forge cannot package this app from a Bun workspace install, and the PTY question was
never reached.**

The proof asked whether a packaged macOS app on arm64 and x64 loads `node-pty`, opens a PTY and
exits cleanly. Packaging never produced an app containing `node-pty`, so nothing about the PTY, and
nothing about x64, is proved either way. What is proved is the blocker, and it is precise.

**Forge's production-dependency walker, `flora-colossus`, requires a physically nested,
npm-shaped `node_modules` tree under the app directory. Bun's workspace install never produces
one — under either linker.** The walker resolves a dependency by literal path, checking
`<app>/node_modules/<parent>/node_modules/<dep>` and then `<app>/node_modules/<dep>`. Bun's
`hoisted` linker puts every package in the *workspace root* `node_modules`, so
`apps/desktop/node_modules` does not exist at all. Bun's `isolated` linker creates
`apps/desktop/node_modules/<pkg>` as a symlink into `node_modules/.bun/<pkg>@<version>/node_modules/`,
where that package's own dependencies sit as *siblings* rather than nested children. Node's
resolution algorithm walks up and finds them. `flora-colossus` does not use Node's resolution
algorithm, so it does not.

This is not a Vite problem, so **the fallback named in the toolchain decision — keep Forge, swap
the Vite plugin for the Webpack plugin — would not fix it.** The walker runs in Forge's package
step, underneath whichever build plugin is configured.

## What it takes to reproduce

The scaffold is committed at `apps/desktop`, and `apps/desktop/scripts/prove-packaged-pty.mjs` is
the proof harness: it packages with Forge, launches the real binary inside the `.app`, and asserts
on both the JSON line the main process prints and the process exit code. `apps/desktop/README.md`
carries the operating instructions.

```sh
cd apps/desktop
node scripts/prove-packaged-pty.mjs --arch arm64
```

Requires **Node 22.12 or newer** on `PATH`; see the Node finding below. Everything measured here
was run on macOS 25.5.0, arm64, at repo commit `e42d43dc`.

## The four layers, in the order they surfaced

Each of these had to be fixed before the next became visible. Every one is a real finding; the
first three are fixed in the committed scaffold, and the fourth is the blocker.

### 1 · Electron 44 ships no `postinstall`, and the repo's Node is too old for its installer

`bun install` alone leaves **no Electron binary**. Electron 44 removed the `postinstall` script
entirely; the binary arrives through a separate `install-electron` step. Running that step then
fails on the repo's ambient Node 22.10.0 with `ERR_REQUIRE_ESM`, because Electron 44's CommonJS
`install.js` requires `@electron/get` v5, which is ESM-only. Electron's own `engines.node` says
`>= 22.12.0` and it means it.

**The repo pins no Node version anywhere** — no `.nvmrc`, no `.node-version`, no `engines`. Its
ambient Node is below what Electron 44 requires. That is a decision, not a fix, and it belongs to
the quality-gate ticket.

> **Resolved, and no longer true of the tree.** #1751 chose 24.20.0 exactly and #1777 wired it:
> there is now a root `.node-version`, `scripts/node-version-gate.mjs` enforces it at root
> `preinstall` and before every Forge command, and CI reads the same file. The measurement above
> stands as of 2026-09-08; the state of the repo it describes does not.

Working recipe, after every `bun install`:

```sh
node node_modules/electron/install.js        # or apps/desktop/node_modules/... under the isolated linker
```

**Do not use `npx install-electron --no`**, which the failure message itself suggests. It deletes
`node_modules/electron` first, and npx's own `--no` flag then refuses to reinstall it, leaving no
Electron at all and needing `bun install --force` to recover.

### 2 · Bun reads `trustedDependencies` from the root `package.json` only

The copy in `apps/desktop/package.json` is inert. Without root entries, `fs-xattr` and
`macos-alias` never build, and the DMG maker fails on them. `esbuild` is blocked too. The root now
declares them. Note that `trustedDependencies` only takes effect for a *newly installed* package;
on an already-installed tree, `bun pm trust` reports nothing to do and the scripts must be
triggered by removing the packages and reinstalling.

### 3 · The Vite plugin packages the Vite output and nothing else

`@electron-forge/plugin-vite` sets, in `VitePlugin.js`:

```js
forgeConfig.packagerConfig.ignore = (file) => !file.startsWith('/.vite')
```

So `node_modules` is never copied into the package. This is deliberate — the plugin assumes Vite
bundled every dependency into `.vite`. **A native module cannot be bundled**, so under the default
config `node-pty` can never reach the packaged app.

The observable behaviour is the worst kind: **Forge exits 0**, writes a complete, launchable
`.app`, and the app dies on its first `require`. The arm64 asar contained exactly ten entries —
`.vite/build/main.js`, `.vite/build/preload.js`, the renderer bundle, and `package.json` — with no
`node_modules` and no `app.asar.unpacked`. The launched app printed nothing, hung, and was killed
at the 60-second timeout, because a failed `require` at the top of the main process raises a modal
error dialog that never exits.

The plugin defers to an `ignore` function the config supplies, which is the supported way to keep
a native module. `forge.config.ts` now does that. **Every native runtime dependency has to be
named there**, and nothing warns when one is missing.

### 4 · The blocker: `flora-colossus` cannot walk a Bun tree

With the copy filter fixed, packaging reached the dependency walker and failed there:

```
Failed to locate module "node-addon-api" from ".../apps/desktop/node_modules/node-pty"
```

`node-pty` depends on `node-addon-api`, which under Bun's isolated linker lives at
`node_modules/.bun/node-pty@1.1.0/node_modules/node-addon-api` — a sibling of `node-pty`, not a
child. Declaring `node-addon-api` directly in `apps/desktop/package.json` puts it at
`apps/desktop/node_modules/node-addon-api` and does clear that error.

**And then the walker moves to the next one.** It walks `devDependencies` as well, so the next
failure was `@electron-forge/core` from `@electron-forge/cli`, and behind that stand dozens more.
Declaring transitive dependencies one at a time is not a fix; it is an unbounded list that
duplicates the lockfile by hand.

Neither linker avoids this. `hoisted` and `isolated` were both tried, and a physical `cp -R` of
`node-pty` into `apps/desktop/node_modules` was tried as well — that one orphans the package from
its own dependencies and fails identically.

## What this leaves the map

The scaffold, the pins, the fuses config, the proof harness and the first three fixes are real work
that stands. The toolchain decision's shape is not disproved: Forge did build main, preload and the
React renderer through the Vite plugin, and did produce a launchable signed-less `.app` whose main
process ran. Only the native dependency cannot get in.

**The decision owed is how `apps/desktop` gets an npm-shaped install**, and it is a repo-level
question because the answer touches the one-lockfile property of the monorepo. The options, none of
them chosen here:

- A **prod-only npm install** into `apps/desktop` as a package step, giving the walker the physical
  tree it wants and leaving Bun to own development. Costs a second lockfile or a generated one.
- **Move `apps/desktop` out of the Bun workspace** and let it own its own install entirely.
- **Bundle no native module**: reach the PTY through a helper process that is shipped as a binary
  rather than a Node module, so the app has no production dependencies at all. This is the option
  that keeps Bun and the single lockfile, and it is a process-design decision, not a packaging one.
- **electron-builder** instead of Forge for the package step. It does not use `flora-colossus`.
  This reopens the lifecycle-ownership question the toolchain decision closed, and the retired
  Electron app used exactly this pair.

Two smaller things also want a home: the **Node version pin** (finding 1), and the fact that
**`forge.config.ts` now carries a hand-maintained list of what enters the package** (finding 3),
which nothing checks.

## What is still unproved

- Whether `node-pty` loads and opens a PTY inside a packaged Argo app. Not reached.
- Anything at all about **x64**. Not reached. Rosetta 2 is present on the test machine, so the
  launch half of that check is runnable once packaging works.
- The **production fuses** (`RunAsNode: false`, ASAR integrity, only-load-from-ASAR). They are
  configured and were present in the packaged app, but no packaged app has yet run far enough to
  say they are compatible with a working PTY.
- Signing, notarization and the DMG and ZIP makers. Out of this ticket.

## Primary sources

- `node_modules/@electron-forge/plugin-vite/dist/VitePlugin.js` — the `ignore` default quoted
  above, read at 7.11.2.
- `node_modules/flora-colossus/lib/Walker.js` — the walker whose literal-path lookup is the
  blocker, at 2.0.0.
- `node_modules/electron/package.json` (44.2.0) — no `postinstall`; `engines.node >= 22.12.0`.
- `node_modules/node-pty/package.json` (1.1.0) — `dependencies: { node-addon-api: ^7.1.0 }`.
- `bunfig.toml` — `linker = "hoisted"`, and the comment claiming that layout is friendlier for
  Electron native modules. For Forge packaging in a workspace, the linker choice makes no
  difference; neither shape works.
- `docs/research/2026-09-08-electron-desktop-toolchain.md` on branch
  `research/choose-electron-desktop-toolchain` — the decision this ticket tested.
- Versions pinned and used: Electron 44.2.0, every `@electron-forge/*` at 7.11.2,
  `@electron/fuses` 2.1.3, `node-pty` 1.1.0, Bun 1.3.13, Node 24.3.0 for the Forge invocations.
