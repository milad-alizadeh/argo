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

A working dev server proves nothing about the product. Everything that can break about a packaged
`node-pty` breaks **silently** — a missing exec bit, a native module still inside the asar, a
production install that produced nothing at all. None of them raise; they just make every
`pty.spawn` fail. So the gate is the **packaged** app, and it runs in two tiers
([#1769](https://github.com/milad-alizadeh/argo/issues/1769)).

**The source tier** needs no Mac and runs on Linux CI as part of `bun run test`:

```sh
bun test        # from apps/desktop
```

It reads the config rather than the artifact: node-pty is a production dependency, the second
lockfile agrees with the manifest, the yauzl override is in place, the unpack glob covers the whole
module, `OnlyLoadAppFromAsar` is on, both Forge hooks are wired, and the checks themselves pass
against fixture trees.

**The artifact tier** needs a Mac, because it packages, reads the fuse wire out of the shipped
binary and then runs it:

```sh
bun run package --arch arm64                       # the postPackage hook asserts on its own
bun run assert:packaged out/Argo-darwin-arm64/Argo.app   # the same checks, standalone
node scripts/prove-packaged-pty.mjs --arch arm64   # package, then launch and run acceptance
node scripts/prove-packaged-pty.mjs --arch arm64 --skip-package
node scripts/prove-packaged-pty.mjs --arch arm64 --skip-endurance
```

`assert:packaged` is the same code `forge package` runs in its `postPackage` hook, so packaging
already refuses an app whose `node-pty` is absent, packed inside the asar, or stripped of its
`spawn-helper` exec bit. Running it standalone is the form a downloaded release artifact would be
checked in, and it keeps the checks honest if the hook is ever detached from the config.

`prove-packaged-pty.mjs` then launches the real binary inside the `.app` with
`ARGO_PTY_ACCEPTANCE=1` and reads back one JSON line plus the exit code. It covers the
[#1749](https://github.com/milad-alizadeh/argo/issues/1749) boundary: start, input, output, resize,
interrupt, exactly-once exit, crash cleanup, app shutdown, and 600 spawn/exit cycles at a flat
descriptor count.

Only arm64 is proved. [#1745](https://github.com/milad-alizadeh/argo/issues/1745) ships arm64
alone. It packages but does **not** sign: `osxSign` is unconfigured until the entitlement set is
chosen ([#1771](https://github.com/milad-alizadeh/argo/issues/1771)) and this repository holds no
identity. When both arrive, the signing steps belong between the package and the launch, and
`assert:packaged` should run **again** after them, because a re-signature can invalidate what the
package proved.

### node-pty is pinned to the `beta` line, and it is the endurance check that pins it

`node-pty@1.1.0` — the `latest` tag — leaks three file descriptors per terminal on macOS, one of
them a `/dev/ptmx`. Measured here at 600 cycles of `/bin/sh -c 'exit 0'` with the exit awaited each
time:

| version | result | descriptor growth |
| --- | --- | --- |
| `1.1.0` (`latest`) | **failed at cycle 497**, `posix_spawnp failed.` | +1492 |
| `1.2.0-beta.15` (`beta`) | 600/600 | 0 |

Calling `kill()` or `destroy()` changes nothing, and nothing you can do from JavaScript does: the
JS layer is byte-for-byte equivalent between the two versions. The fix is entirely native, in
`src/unix/pty.cc` — the beta closes every inherited descriptor at or above 3 in the child, sets
close-on-exec, and closes the master on the error path and the slave in the parent. So do not go
looking in `unixTerminal.js` for it.

`kern.tty.ptmx_max` is 511 on macOS, so on `1.1.0` a cockpit process can open about 500 PTYs in
its entire lifetime however cleanly each one is closed — a hard ceiling on exactly what
[#1791](https://github.com/milad-alizadeh/argo/issues/1791) chose node-pty to be. The `beta` tag
ships until the fix reaches `latest`; the source tier accepts any node-pty at 1.2.0 or above, so
the stable release needs no test edit. Downgrading turns the packaged endurance check red, and that
is the check working.

One behaviour change rides along with the fix: closing every inherited descriptor means a spawned
CLI can no longer be handed one. Nothing in Argo does that today.

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
