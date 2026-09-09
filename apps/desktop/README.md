# apps/desktop

Argo's cockpit on Electron, React and TypeScript. It runs beside `apps/macOS` for the whole
migration; nothing is removed from the Swift app until this one passes migration acceptance.

The toolchain is fixed by [Choose the Electron desktop toolchain](https://github.com/milad-alizadeh/argo/issues/1732)
and proved by [Prove the packaged Electron toolchain](https://github.com/milad-alizadeh/argo/issues/1743).
**Electron Forge owns the whole lifecycle** — start, native rebuild, package, make, sign, publish.
Every `@electron-forge/*` package and Electron itself are pinned exactly, because Forge marks its
Vite plugin experimental and reserves breaking changes for a minor release. Upgrade them as one
reviewed unit.

## The acceptance test

A working dev server proves nothing about the product. The gate is the **packaged** app:

```sh
bun run prove:pty                          # both architectures
bun run prove:pty --arch arm64
bun run prove:pty --skip-package           # re-launch what is already in out/
```

Through the script, not `node scripts/prove-packaged-pty.mjs` directly: the script carries the
Node-pin gate, and the bare `node` invocation packages with Forge on whatever Node you are on.

It packages with Forge, launches the real binary inside the `.app`, and asserts that the app
loaded `node-pty`, opened a PTY that ran a shell, reported the architecture it was built for, and
exited with code 0. `src/main.ts` holds the check itself behind `ARGO_PTY_SMOKE=1`.

**The `node-pty` half of that is superseded and this script has not caught up.**
[Prove the packaged Electron toolchain](https://github.com/milad-alizadeh/argo/issues/1743) found
that Forge's dependency walker cannot reach `node-pty` from a Bun workspace install at all, so the
assertion above cannot pass as written.
[Choose cross-platform Session process hosts](https://github.com/milad-alizadeh/argo/issues/1749)
and [Choose how apps/desktop gets an npm-shaped install](https://github.com/milad-alizadeh/argo/issues/1750)
replaced it with a compiled Bun 1.4 `Bun.Terminal` helper, which does pass the same harness. This
test is also in no quality gate, because it needs a Mac, a full package and several minutes;
[where it runs](https://github.com/milad-alizadeh/argo/issues/1758) is the open ticket.

## Two things will bite you

**Node is pinned exactly, and the pin is enforced.** The root `.node-version` is the single place
the version is written, and `scripts/node-version-gate.mjs` refuses any other version, including a
newer patch. It runs at root `preinstall`, so a wrong Node fails `bun install`, and before every
command here that reaches Electron or Forge. `bun run quality` runs it first, and CI reads the same
file through `node-version-file:`.

Do not read that failed install as "nothing happened": bun runs the root `preinstall` *after* it
has linked `node_modules` and built the native dependencies, so on the wrong Node `node-pty` is
already compiled against the wrong ABI. **Delete `node_modules` and install again** once you are
on the pinned version.

The reason it is a gate rather than a note: Electron 44 declares `engines.node >= 22.12.0` and
means it, its installer is CommonJS and requires an ESM-only `@electron/get`, and on an older Node
it dies with `ERR_REQUIRE_ESM` — a message that says nothing about your Node. The exactness is
[#1751](https://github.com/milad-alizadeh/argo/issues/1751)'s decision and
[#1777](https://github.com/milad-alizadeh/argo/issues/1777) wired it.

**Your version manager probably will not apply the pin for you.** nvm reads `.nvmrc` and has no
`.node-version` fallback at all. `fnm` reads `.node-version` but installs nothing, so it needs an
`fnm install` first. `asdf` reads it only with `legacy_version_file = yes` in `~/.asdfrc`, and
ignores the file by default. Switch by hand, from this directory:

```sh
nvm install "$(cat ../../.node-version)" && nvm use "$(cat ../../.node-version)"
fnm install "$(cat ../../.node-version)" && fnm use "$(cat ../../.node-version)"
```

**Electron 44 ships no `postinstall`.** `bun install` alone leaves you with no Electron binary at
all. Install it explicitly afterwards, **from the repo root**:

```sh
bun run install:electron
```

That is `node_modules/electron/install.js` behind the Node-pin gate. Run the installer directly
and you get the one failure the pin exists for — `ERR_REQUIRE_ESM`, out of a CommonJS installer
requiring an ESM-only `@electron/get`, saying nothing about your Node. The script is also why the
path is not spelled here: bun hoists Electron to the root, and this package has no `node_modules`
of its own.

Do **not** use `npx install-electron --no`. It deletes `node_modules/electron` first, and npx's
own `--no` flag then refuses to reinstall it, so you end up with nothing and need
`bun install --force` to recover.

Bun's `trustedDependencies` is read from the **root** `package.json` only. The copy in this
package is inert. Without the root entries, `fs-xattr` and `macos-alias` never build and the DMG
maker fails.

## Layout

`src/main.ts` and `src/preload.ts` are flat files on purpose. Forge's Vite plugin emits both
targets into `.vite/build` and names each output after its entry file, so two entries called
`index.ts` silently overwrite each other and packaging then fails on a missing main entry. The
entry basenames are the contract with `main` in `package.json` and the preload path in
`src/main.ts`.

The renderer is a placeholder, not a design. Screens arrive per ticket from `docs/designs/`.
