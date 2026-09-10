# apps/desktop

Argo's cockpit on Electron, React and TypeScript. It runs beside `apps/macOS` for the whole
migration; nothing is removed from the Swift app until this one passes migration acceptance.

The toolchain is fixed by [Choose the Electron desktop toolchain](https://github.com/milad-alizadeh/argo/issues/1732)
and proved by [Prove the packaged Electron toolchain](https://github.com/milad-alizadeh/argo/issues/1743).
**Electron Forge owns the whole lifecycle** — start, native rebuild, package, make, sign, publish.
Every `@electron-forge/*` package and Electron itself are pinned exactly, because Forge marks its
Vite plugin experimental and reserves breaking changes for a minor release. Upgrade them as one
reviewed unit.

Run the app against the dev server with `bun run dev` from the repository root. That is Forge's
`start`, so it holds the terminal until you quit the app.

## Visual design infra

- Design stack: `docs/design-stack.md`
- Design rules: `apps/desktop/AGENTS.md`
- Components, live: <https://milad-alizadeh.github.io/argo/>, built from `main` by
  `.github/workflows/storybook-pages.yml`. `?path=/story/<component>--<state>` links one state.
- Components, locally: `bun run storybook` from the repository root
- Build the site: `bun run build:storybook` from the repository root, output
  `apps/desktop/storybook-static`. Set `STORYBOOK_BASE=/argo/` only when the output will be
  served from that path.
- Render one PNG: `cd apps/desktop && bun run design:render`

Every PNG these commands write is disposable. Look at it and delete it: no gate reads one and no
ref holds one ([#1910](https://github.com/milad-alizadeh/argo/issues/1910)).

## Build a local release

On an Apple silicon Mac, use the pinned Node version. Then run these commands from the repository
root:

```sh
bun install
bun run install:electron
bun run build
```

The last command routes the desktop task through Turbo. Forge packages the arm64 app. The package
hook checks its native PTY files. The command then launches the packaged app and runs the full PTY
acceptance proof. A successful run prints the absolute path in this form:

```text
Artifact: /path/to/argo/apps/desktop/out/Argo-darwin-arm64/Argo.app
```

Open that `.app` from Finder, or run `open apps/desktop/out/Argo-darwin-arm64/Argo.app`. This app is
a local test build, not a GitHub Release. macOS gives it an ad-hoc signature. It has no Developer
ID signature or notarization, and it does not satisfy the release verdict. Do not distribute it.

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
bun run prove:pty --arch arm64                     # package, then launch and run acceptance
bun run prove:pty --arch arm64 --skip-package
bun run prove:pty --arch arm64 --skip-endurance
```

Through the script, never `node scripts/prove-packaged-pty.mjs` directly: the script carries the
Node-pin gate (#1777), and the bare `node` invocation packages with Forge on whatever Node you
happen to be on.

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
alone. A local package does not use Developer ID signing. The release workflow supplies the
identity and applies the entitlement set that [#1771](https://github.com/milad-alizadeh/argo/issues/1771)
chose. It runs `assert:packaged` again after signing because a new signature can invalidate the
package proof.

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

## Releasing

One workflow, `.github/workflows/release.yml`, run by hand: **Actions → release desktop → Run
workflow**, with the version as its only input (`1.2.0`, no `v`). It signs, notarizes, makes the
DMG and the ZIP, writes **one `release-verdict.json`**, and publishes only if that verdict passes.
The contract is [ADR-0036](../../docs/adr/0036-a-release-publishes-only-on-a-verdict-that-names-its-bytes.md),
decided in [Decide what refuses a desktop publish, and what the artifact check asserts](https://github.com/milad-alizadeh/argo/issues/1788)
and built in [Publish a desktop release only on a passing release verdict](https://github.com/milad-alizadeh/argo/issues/1807).

The verdict is a single document holding every assertion any tier makes about the build, keyed to
the SHA-256 of every artifact it judged: signing and notarization, the nine fuses read back off the
shipped binary, the entitlements `codesign` reports per signed path, the packaged-PTY acceptance
run, the package manifest, and the one asset `update.electronjs.org` will match. It ships as a
release asset, so the release carries its own evidence. `scripts/release-verdict.mjs` builds it and
`scripts/write-release-verdict.mjs` is the CLI (`bun run desktop:verdict`).

Why a verdict rather than a chain of green steps: a check that never ran has to be as loud as one
that ran and failed. Every assertion is an entry in one file, so "the check is missing" is a single
readable state instead of an absent report nobody notices.

**A published release cannot be unpublished.** GitHub's immutable releases freeze `draft` and
`tag_name` at publish, so `DELETE` is the only removal and it burns that tag name forever. That is
why the gate is before the publish and the whole publish is two steps: create the release as a
draft, then flip it. `.github/workflows/release-backstop.yml` is the compensating action for a
release that got out anyway — on `release: [published]` it re-reads the verdict off the assets,
**files an issue carrying the evidence, and then deletes the release**, in that order, because the
delete destroys the evidence. It is not a prevention: a client that already staged the update
installs it regardless, since that install path touches no network. Publishing a higher version is
the only remedy, and the filed issue is what makes somebody cut one.

### What a human has to set up first

None of this is code, and the workflow fails loudly without it. What distribution does until it
exists is [ADR-0037](../../docs/adr/0037-without-a-developer-id-there-is-no-release.md), which
proposes building from source and publishing nothing, and is not accepted yet.

1. **A Developer ID Application certificate**, from an Apple Developer Program account
   (99 USD/year). Create it in the developer portal, then export it from Keychain Access as a
   `.p12` with a password, and base64 it: `base64 -i cert.p12 | pbcopy`.
2. **An App Store Connect API key** for notarization, at Users and Access → Integrations, with the
   *Developer* role. Download the `.p8` **once** — Apple will not serve it again — and base64 it
   the same way. Note the Key ID and the Issuer ID off the same page.
3. **A GitHub Environment named `release`** (Settings → Environments). The workflow declares
   `environment: release`, so adding required reviewers there is what puts a human approval in
   front of every publish. Its six secrets:

   | Secret | What it holds |
   | --- | --- |
   | `MACOS_CERTIFICATE_P12` | base64 of the `.p12` |
   | `MACOS_CERTIFICATE_PASSWORD` | the password used on export |
   | `MACOS_SIGNING_IDENTITY` | the identity string, e.g. `Developer ID Application: Name (TEAMID)` |
   | `APPLE_API_KEY_P8` | base64 of the `.p8` |
   | `APPLE_API_KEY_ID` | the Key ID |
   | `APPLE_API_ISSUER` | the Issuer ID |

4. **Turn on immutable releases** — Settings → General → Releases. There is no API for this
   setting, so nothing here can check it before the fact; the workflow reads the per-release
   `immutable` boolean back after publishing and warns in the job summary if it is false.
5. **A `CHANGELOG.md` in this directory**, whose `## <version>` heading the workflow reads for the
   release notes. `/release-argo` ([#1808](https://github.com/milad-alizadeh/argo/issues/1808))
   writes it; until then, by hand.

Everything else stays working without any of it: signing is driven by the environment, so a Linux
CI job or a fork pull request still packages, and its verdict simply records `signed: false` — a
different verdict rather than an absent one.

## Layout

`src/main.ts` and `src/preload.ts` are flat files on purpose. Forge's Vite plugin emits both
targets into `.vite/build` and names each output after its entry file, so two entries called
`index.ts` silently overwrite each other and packaging then fails on a missing main entry. The
entry basenames are the contract with `main` in `package.json` and the preload path in
`src/main.ts`.

The renderer is the cockpit shell: a chrome band, a sidebar of five destinations, and one deck.
`src/renderer/components/ui/` is written by the shadcn CLI and is never hand-edited;
`src/renderer/modules/` contains the maintained domain components and hooks. The frame and the surfaces are
[ADR-0038](../../docs/adr/0038-the-desktop-cockpit-is-opaque.md), the design workflow is
[`docs/design-stack.md`](../../docs/design-stack.md), and the prose no linter checks is
[`apps/desktop/AGENTS.md`](AGENTS.md).

## Portable integration proof

The Project-opening contract and its proof are recorded in
[`docs/portable-integration-contracts.md`](../../docs/portable-integration-contracts.md).
The proof crosses the packaged renderer, preload, and main process with isolated storage.
It does not import Swift data.

Package arm64 first; all three commands run the copy, never the app you have installed.

| Command | What it produces |
| --- | --- |
| `bun run prove:project-contract` | The verdict for the Project workflow, naming every case, as JSON. |
| `bun run capture:cockpit` | One PNG per deck state and appearance, in `out/cockpit-captures`. |
| `bun run measure:cockpit` | Startup and idle evidence, printed as JSON. |

The proof keeps its window hidden. The other two show it, because Chromium throttles a hidden
window and both a capture and a frame reading taken from one measure the throttle. None of the
three holds the real keyboard or the real mouse.

## Performance evidence

`bun run measure:cockpit` launches the packaged app five times and reports the median, which is
the FAIL line [#1736](https://github.com/milad-alizadeh/argo/issues/1736) set. An idle cockpit
schedules no work, so an idle `requestAnimationFrame` delta is the display's own period and cannot
read below it. The budget is therefore taken from the display the run used, and the reading is
compared against 1.5 times it, the ratio #1736's 12.5 ms holds to its 120 Hz reference panel.

Only a run on the 120 Hz reference panel is judged. Anywhere else the `verdict` field reads
`unjudged`, the command exits zero, and `withinCeiling` carries the comparison for the reader.
The judged run is still the human's to make on the reference Mac.
