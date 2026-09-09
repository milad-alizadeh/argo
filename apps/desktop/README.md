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
node scripts/prove-packaged-pty.mjs            # both architectures
node scripts/prove-packaged-pty.mjs --arch arm64
node scripts/prove-packaged-pty.mjs --skip-package   # re-launch what is already in out/
```

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

**Node must be 22.12 or newer.** Electron 44 declares `engines.node >= 22.12.0` and means it. Its
installer is CommonJS and requires `@electron/get` v5, which is ESM-only, so on an older Node it
dies with `ERR_REQUIRE_ESM`. The repo still pins no Node version, but that is no longer an open
question: [Pin a Node version for the repo](https://github.com/milad-alizadeh/argo/issues/1751)
chose 24.20.0 exactly, in a root `.node-version`, and
[implementing it](https://github.com/milad-alizadeh/argo/issues/1777) is the open ticket. Until
that lands, nothing checks the Node you are on and this failure is the first thing you will see.

**Electron 44 ships no `postinstall`.** `bun install` alone leaves you with no Electron binary at
all. Install it explicitly afterwards:

```sh
node node_modules/electron/install.js
```

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
