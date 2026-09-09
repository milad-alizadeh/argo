# Production and test Electron fuse profiles

**Date:** 2026-09-08 · **For:** [Define production and test Electron fuse profiles](https://github.com/milad-alizadeh/argo/issues/1757),
under the migration map [cross-platform Electron desktop migration](https://github.com/milad-alizadeh/argo/issues/1730),
keeping the posture of [Choose the Electron desktop toolchain](https://github.com/milad-alizadeh/argo/issues/1732)
and [Prove the packaged Electron toolchain](https://github.com/milad-alizadeh/argo/issues/1743) ·
**Status:** decision-ready. The production profile was **measured on a packaged arm64 app in this
worktree**, and it passes the packaged PTY proof.

## The answer

**The fuse wire in Electron 44.2.0 has exactly nine fuses. Name all nine in both profiles. The
test profile differs from production in exactly one of them: `EnableNodeCliInspectArguments`.**

That one divergence exists because Playwright's Electron launcher attaches through the Node
inspector, and Playwright's own docs name that fuse as the thing to check when a launch times out.
Nothing else in the process-host acceptance suite needs a fuse relaxed — and two of the fuses must
stay at their production values in the test flavor precisely *because* the suite's first item is a
test of them.

The production profile is already correct in `apps/desktop/forge.config.ts` for the six fuses it
names, and it works: `node scripts/prove-packaged-pty.mjs --arch arm64 --skip-package` passed here
against the packaged app, with the compiled Bun helper, 600 PTY cycles, file descriptors back to
baseline, and a `SIGKILL` crash probe leaving no surviving child.

```
1/1 architectures proved
{ "ok": true, "helperArchitecture": "arm64", "bunVersion": "1.4.2", "resized": true,
  "interrupted": true, "enduranceCycles": 600, "descriptorBaseline": 30, "descriptorAfter": 30,
  "electron": "44.2.0", "node": "24.20.0", "packaged": true }
{ "crash": { "signal": "SIGKILL", "survivors": [] } }
```

Three things this ticket changes rather than confirms: the config must name **all nine** fuses and
set `strictlyRequireAllFuses`, the built artifact must have its fuses **read back off the binary**
by an exit code, and the test flavor needs an identity of its own so it cannot be published.

## The wire, and both profiles

Nine fuses, `FuseVersion.V1`, indices 0–8. The names and indices are from the pinned
`@electron/fuses` 2.1.3 (`node_modules/@electron/fuses/dist/config.js`), the semantics from
[Electron's fuses tutorial at v44.2.0](https://raw.githubusercontent.com/electron/electron/v44.2.0/docs/tutorial/fuses.md),
and the defaults from
[`build/fuses/fuses.json5` at v44.2.0](https://raw.githubusercontent.com/electron/electron/v44.2.0/build/fuses/fuses.json5).
The **Default** column was independently confirmed by reading the three unconfigured fuses back off
the app packaged in this worktree, where they were left to inherit.

| # | Fuse | Default | Production | Test | Why |
| --- | --- | --- | --- | --- | --- |
| 0 | `RunAsNode` | on | **off** | **off** | Ignores `ELECTRON_RUN_AS_NODE`. No Session host uses `child_process.fork`: the Claude host is a compiled Bun binary and the Codex host is `codex app-server`, both spawned by absolute path. Playwright never sets the variable, and an *inherited* `ELECTRON_RUN_AS_NODE=1` is a known cause of launch failure, so off helps the test flavor too. |
| 1 | `EnableCookieEncryption` | off | **off** | **off** | Keep the default until the credential-storage design lands. The transition is one-way and it depends on a stable macOS signature, so it must not be turned on by a test flavor or by a build that is ad-hoc signed. |
| 2 | `EnableNodeOptionsEnvironmentVariable` | on | **off** | **off** | Ignores `NODE_OPTIONS` and `NODE_EXTRA_CA_CERTS`. Nothing in the suite passes either; Playwright deletes `NODE_OPTIONS` from the child environment itself. |
| 3 | `EnableNodeCliInspectArguments` | on | **off** | **on** | **The only divergence.** Off, `--inspect` is ignored and the main process is not debuggable. On, Playwright can attach. Justified below. |
| 4 | `EnableEmbeddedAsarIntegrityValidation` | off | **on** | **on** | Validates the `app.asar` header hash at launch and force-terminates on a mismatch. Acceptance item 1 is "the signed ASAR build loads the helper", so a test flavor with this off would delete the test. |
| 5 | `OnlyLoadAppFromAsar` | off | **on** | **on** | Electron otherwise searches `app.asar` → `app` → `default_app.asar`, and the docs say integrity checking "can be bypassed via the Electron app code search path" without this. Same reason it stays on in test. |
| 6 | `LoadBrowserProcessSpecificV8Snapshot` | off | **off** | **off** | It isolates the main process from a snapshot built for `nodeIntegration` renderers. Argo's renderers run `nodeIntegration: false`, so it buys nothing and costs main-process startup, which the performance budget ticket owns. Named explicitly so an upgrade cannot move it. |
| 7 | `GrantFileProtocolExtraPrivileges` | on | **on** | **on** | Keep the default while `src/main.ts` loads the renderer with `window.loadFile`, i.e. from `file://`. Removing `fetch` over `file://` would break Atlas asset loading. This is a capability of the page Argo itself ships, not a command-line or environment escape hatch, so keeping it does not widen the attack surface a fuse profile is for. Flipping it belongs with moving the renderer to a registered custom scheme. |
| 8 | `WasmTrapHandlers` | on | **on** | **on** | V8 uses signal-handler guard pages to trap out-of-bounds WebAssembly memory access. This is a hardening feature; disabling it makes WASM slower and larger and removes a memory-safety check. |

`EnableCookieEncryption` was the one row the toolchain decision deliberately left open. Fixing it at
`false` in both profiles is not a new decision about credentials — it is the statement that a fuse
profile is not where that decision gets made, and that the value is identical in both flavors so
the test flavor can never be the thing that migrates a user's cookie store.

## The production profile is the baseline

The toolchain decision (#1732) set the posture: package into ASAR, disable the unused Node escape
hatches, enable ASAR integrity and only-load-from-ASAR, sign with a Developer ID and notarize,
and keep `EnableNodeCliInspectArguments` enabled in the E2E flavor only. This note keeps every part
of that and adds the four rows it did not name (indices 1, 6, 7, 8), so no fuse is left to a
default.

The posture in one sentence: **the shipped binary honours no environment variable and no command
line flag that grants Node privileges, and it will not run application code that is not the
hash-checked archive.** Both halves matter. Indices 0, 2 and 3 close the escape hatches — Electron's
security checklist item 19 says of exactly these that they "can let external scripts run commands
that they potentially would not be allowed to, but that your application might have the rights for",
and the rights Argo's main process holds are the user's git working trees, the spawned CLI
environments and the keychain-backed Accounts. Indices 4 and 5 close the code path.

Fuses are a build-time layer and not a substitute for the runtime settings. Electron's checklist
keeps `contextIsolation` (item 3), `sandbox` (item 4) and `nodeIntegration` (item 2) as separate
items. `src/main.ts` today sets `contextIsolation: true` and `nodeIntegration: false` but
`sandbox: false`; that is checklist item 4 and it is not a fuse question, so it is left where it is.

## The smallest test delta: one fuse

**`EnableNodeCliInspectArguments: true`, and nothing else.**

Playwright's Electron launcher builds its argv as
`['--inspect=0', '--remote-debugging-port=0', ...args]` and then blocks on a stderr line matching
`/^Debugger listening on (ws:\/\/.*)$/`, connecting to the Node inspector WebSocket first to get a
CDP session into the **main process**, then racing for the Chromium `DevTools listening on ws://`
line to drive each `BrowserWindow` as a page
([`electron.ts` in `playwright-core`](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/server/electron/electron.ts)).
With fuse 3 off, `--inspect=0` is ignored, that line never appears, and the launch times out.
Playwright documents this as its one fuse requirement, verbatim: "Ensure that `nodeCliInspect`
(`FuseV1Options.EnableNodeCliInspectArguments`) fuse is **not** set to `false`"
([`class-electron.md`](https://github.com/microsoft/playwright/blob/main/docs/src/electron-api/class-electron.md)).

Which acceptance items need it, and which do not:

- **Items 2–10** — Claude start, input, resume and name, control, Codex start, resume and control,
  ownership isolation, failure surfaces — assert on roster state, the preload bridge and rendered
  windows. They are Playwright's job, so they need the main-process CDP session, so they need
  fuse 3.
- **Items 1, 11 and 12** — packaged loading, crash recovery, PTY endurance — need **no fuse
  relaxed**, and they are already implemented that way. `apps/desktop/scripts/prove-packaged-pty.mjs`
  launches the real binary, and the app drives itself behind `ARGO_PTY_SMOKE=1`; the crash probe
  `SIGKILL`s the main process from outside. That harness passed here against the **production**
  fuse set.

So the split is: **the production artifact must pass items 1, 11 and 12 itself**, and only items
2–10 run on the one-fuse test flavor. That keeps the divergence away from the items that judge the
security posture, and it means the shipping artifact is never exempt from acceptance.

Three relaxations were considered and rejected as convenience:

- `RunAsNode` — nothing forks the Electron binary, and Playwright never sets the variable
  (zero occurrences in its source). Leaving it off is strictly better for the test flavor.
- `EnableNodeOptionsEnvironmentVariable` — Playwright deletes `NODE_OPTIONS` from the child
  environment before spawn, with the comment that an external debugger attaching there would fight
  its own automation. Enabling the fuse would only re-open a hatch the harness closes.
- `EnableEmbeddedAsarIntegrityValidation` / `OnlyLoadAppFromAsar` — turning either off in the test
  flavor removes acceptance item 1.

## How each fuse value is proved

Two gates, one on the write and one on the read, and both are exit codes.

**Write side — the build refuses an unnamed fuse.** Set `strictlyRequireAllFuses: true` in the
`FusesPlugin` config and give all nine fuses a value. `@electron/fuses` then throws
`strictlyRequireAllFuses: Missing explicit configuration for fuse <name>` for any fuse left to
inherit, and `... the fuse wire in the Electron binary has N fuses but you only provided a config
for M` when Electron's wire grows (`dist/index.js`, `setFuseWire`). That converts the one silent
failure mode of this design — an Electron upgrade adding a tenth fuse whose default nobody chose —
into a failed `forge package`. It is currently **not** set.

**Read side — the artifact is measured, not trusted.** Use the API, not the CLI:

```js
import { getCurrentFuseWire, FuseState, FuseV1Options } from '@electron/fuses'
const wire = await getCurrentFuseWire('out/Argo-darwin-arm64/Argo.app')
```

`getCurrentFuseWire` resolves a `.app` path to
`Contents/Frameworks/Electron Framework.framework/Electron Framework`, finds the sentinel
`dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX`, and returns `{ version, 0..8: FuseState }` where
`ENABLE = 0x31`, `DISABLE = 0x30`, `INHERIT = 0x90`, `REMOVED = 0x72`. The check must fail on a
wrong state, a missing index, an extra index, a `version` that is not `'1'`, and any `INHERIT`.

The CLI form `npx electron-fuses read --app <path>` is for humans. It prints coloured text and
exits 0 whatever the values are, so a new fuse simply adds a line nobody asserts on. That is the
shape of check this repo already refuses. It is still the right tool to read a build by hand, and
it is how the values in this note were confirmed:

```
$ ./node_modules/.bin/electron-fuses read --app out/Argo-darwin-arm64/Argo.app
Fuse Version: v1
  RunAsNode is Disabled                            EnableEmbeddedAsarIntegrityValidation is Enabled
  EnableCookieEncryption is Disabled               OnlyLoadAppFromAsar is Enabled
  EnableNodeOptionsEnvironmentVariable is Disabled LoadBrowserProcessSpecificV8Snapshot is Disabled
  EnableNodeCliInspectArguments is Disabled        GrantFileProtocolExtraPrivileges is Enabled
                                                   WasmTrapHandlers is Enabled
```

**Where the check lives.** `apps/desktop/scripts/packaged-app.mjs` already exports `exitFailures`
and `resultFailures` and returns arrays of strings that its caller turns into an exit code. A
`fuseFailures(appPath, profile)` beside them, called by `prove-packaged-pty.mjs` before the launch
and again by the release job before `electron-forge publish`, needs no new machinery. The nine
values must live in **one module that `forge.config.ts` imports to write and the check imports to
read**, so the assertion cannot drift from the config, and deleting the profile breaks the build
rather than silencing the check.

**Nothing runs it automatically today.** `.github/workflows/ci.yml` is `ubuntu-latest` only and has
no desktop job, and packaging, signing and ASAR integrity are all macOS work. Until the release
workflow #1732 describes exists, the only enforcement point is the packaged proof on a developer's
Mac. That is a real gap, not a detail.

**Also prove the signature, because a fuse value is only binding while the signature holds.**
Electron's docs say the OS is what stops the bits being flipped back, "via OS-level code signing
validation (e.g. Gatekeeper on macOS)". So the release check must add: `codesign --verify --deep
--strict` exits 0; `codesign -dvv` reports a `TeamIdentifier` and not `Signature=adhoc`;
`xcrun stapler validate` finds a notarization ticket. The build in this worktree reports
`Signature=adhoc`, `TeamIdentifier=not set` — correct for a proof build, and exactly what the
release check must refuse.

## Keeping a test package out of a release

The failure mode to guard is narrow and severe: **a build with `EnableNodeCliInspectArguments`
enabled reaching a user through auto-update.** Anything that can start Argo with `--inspect` then
gets a Node inspector inside the process that owns the user's repositories, the spawned CLI
environments and the Accounts in the keychain. The fuse is a byte in the shipped binary, so no
runtime check inside the app can detect or undo it. Only reading the artifact before publish can.

Five guards, of which only the last is a gate:

1. **One flavor input, with no default.** `ARGO_PACKAGE_FLAVOR` must be `production` or `e2e`;
   `forge.config.ts` throws on anything else, unset included. An absent variable must not resolve
   to a flavor by accident — the file already uses this shape for the Bun executable and the
   architecture.
2. **Naming that reaches the disk.** `Argo` vs `Argo E2E`, bundle id `tech.trili.argo.desktop` vs
   `tech.trili.argo.desktop.e2e`. The output directory, the DMG and the ZIP all follow the name, so
   the two flavors cannot be confused in `out/` or in a release asset list. The differing bundle id
   also gives the test flavor its own `userData` path, which acceptance item 8 wants anyway.
3. **Signing identity.** Production configures `osxSign` and `osxNotarize` from CI secrets; the
   `e2e` flavor configures neither and stays ad-hoc. An ad-hoc artifact has no team identifier and
   no notarization ticket, so Gatekeeper refuses it on any other Mac, and Electron's code-signing
   doc ties both auto-update and `safeStorage` to a consistent valid signature. A test build is
   therefore not installable as a release even if someone uploaded it.
4. **Update feed.** #1746 ships stable-only from public GitHub Releases through
   `update-electron-app` and `update.electronjs.org`. Initialise the updater only in the production
   flavor, guarded on the same flavor constant, so the test build has no updater code path at all;
   and because its bundle id differs, it could not be updated into the production app's identity.
5. **What refuses the publish.** The release job runs the read-side fuse check against the exact
   artifact it is about to upload, requires the production profile byte for byte, requires the three
   signature assertions above, and requires that neither the bundle id nor the artifact name carries
   the `e2e` marker. Any failure exits non-zero before `electron-forge publish`. Forge publishes to
   a **draft** release that a person promotes (#1732), but the human is not the guard; the exit code
   is.

One live hazard in the current file, flagged and not touched: `signPackage` in `forge.config.ts`
runs `codesign --force --deep --sign -` over the whole `.app` in `postPackage`, unconditionally.
Once production adds `osxSign`, Forge signs during packaging and this hook would then replace the
Developer ID signature with an ad-hoc one — and `--deep` would do it to the nested helper too. The
hook has to become flavor-aware before the first signed build. Relatedly, `FusesPlugin` chooses
`resetAdHocDarwinSignature` itself, as `!hasOSXSignConfig && darwin && arm64`, and a value passed
in the plugin config would override that computation, so do not pass one.

## The asar fuses hold, and they do not cover the helper

This was the open question, and it has two separate answers.

**Can the two asar fuses hold with a compiled Bun helper in the bundle? Yes, measured.** The helper
is an `extraResource`, so it lands at `Contents/Resources/argo-pty-helper`, outside `app.asar`. The
built `Info.plist` carries exactly one integrity entry:

```
ElectronAsarIntegrity => { "Resources/app.asar" => { algorithm => SHA256, hash => ae9d1742... } }
```

The helper is not in the archive, so it cannot change the archive's header hash, and
`EnableEmbeddedAsarIntegrityValidation` has nothing to say about it. `OnlyLoadAppFromAsar`
constrains where Electron looks for **application code**; the helper is not application code
Electron loads, it is a separate process the app spawns by absolute path from
`process.resourcesPath`. Both fuses read `Enabled` on the packaged app, and that app passed the
full PTY proof. This is strictly easier than the `.node` addon it replaced, which would have had to
be unpacked to `app.asar.unpacked` — also outside the header hash, and the reason
`plugin-auto-unpack-natives` exists. It is one of the things #1750's choice bought.

**Do the fuses protect the helper? No. The code signature does, and it does so as data.**
`Contents/_CodeSignature/CodeResources` seals `Resources/argo-pty-helper` in `files` (SHA-1) and
`files2` (`hash2`, SHA-256), so a modified helper breaks `codesign --verify --deep --strict` and
Gatekeeper's first-launch assessment. But it is sealed as a **resource, not as nested code**: its
`files2` entry carries only `hash2`, whereas `Frameworks/Argo Helper (GPU).app` carries a `cdhash`
and a `requirement`. Apple's Technote 2206 describes exactly this consequence for a Mach-O placed
outside the standard nested-code locations — "putting code into other places will cause it to be
sealed as data (resource) files ... this code to be sealed twice" — and adds the warning that
matters here: it "can break the outer signature of apps that use their own update mechanisms to
replace nested code." #1746 gives Argo an update mechanism.

So the fuse answer is that the fuses are fine and the **placement** is wrong. The helper belongs in
a standard nested-code location — `Contents/MacOS` or `Contents/Helpers` — signed inside-out before
the outer bundle, which is the order TN2206 requires and the order `postPackage` already uses. That
is a signing and packaging decision, not a fuse one, so it is a new ticket.

## What no fuse can reach: the helper's own escape hatches

Fuse 0 and fuse 2 close Electron's environment hatches. **The compiled helper has its own, and no
Electron fuse touches them.** Measured on the helper built in this worktree:

```
$ BUN_OPTIONS="--version" ./build/argo-pty-helper < /dev/null
1.4.2
```

The helper honoured `BUN_OPTIONS` and printed a version instead of serving its protocol — Bun
documents standalone executables as reading that variable "so you can pass runtime flags without
recompiling". And `bun build --help` on the pinned Bun shows `--compile-autoload-dotenv` and
`--compile-autoload-bunfig` both **default to true**, so the compiled helper autoloads `.env` and
`bunfig.toml` at runtime. The helper is started with a user's project as its working directory, so a
repository Argo opens can carry both files.

The production posture therefore needs three things the fuse wire cannot give, and they belong with
the helper's build and spawn:

- compile with `--no-compile-autoload-dotenv` and `--no-compile-autoload-bunfig`;
- delete `BUN_OPTIONS` from the environment the main process hands the helper — the process-host
  note already has the main process building that environment and stripping adapter-specific
  variables, so this joins that list;
- give the helper its own entitlements. Bun's own codesigning guidance asks for
  `com.apple.security.cs.allow-jit`, `allow-unsigned-executable-memory`,
  `disable-executable-page-protection`, `allow-dyld-environment-variables` and
  `disable-library-validation`. Two of those weaken the helper considerably, and inheriting them to
  the whole app would be worse, which is another reason the helper must be signed as its own nested
  code rather than as a resource of the app.

## What I could not verify

- **Whether `BUN_OPTIONS` can open a debugger in the helper.** `--inspect` and `--inspect-brk` via
  `BUN_OPTIONS` printed no banner and did not hold the process. So the variable is proved to change
  the helper's behaviour, but an inspector channel is **neither demonstrated nor ruled out**.
- **Hardened runtime and spawning children.** Apple's current hardened-runtime and entitlement
  pages are client-rendered and could not be read as text. TN2206 does not cover it. Whether the
  hardened runtime needs an entitlement for Argo to spawn its differently-entitled helper is
  **unverified**; it must be settled by signing and notarizing one real build.
- **Whether ASAR integrity covers `app.asar.unpacked`.** Electron's asar-integrity doc defines the
  mechanism over the archive header and its blocks and never mentions unpacked files. Treat unpacked
  content as **not covered** — but that is a reading of silence, not a statement in the doc.
- **`EnableCookieEncryption` being one-way.** Documented, not measured.
- **Bun flag names at the pin.** `bun build --help` was read at the ambient Bun 1.3.13 while the
  repo pins `bun@1.4.2`; the compiled helper reports `1.4.2`, so 1.4.2 is what builds it. Re-check
  the three `--compile-autoload-*` flag names against 1.4.2 before relying on them.
- **Anything about x64 or universal builds.** #1745 makes arm64 the only macOS artifact, and only
  arm64 was measured. Note that `flipFuses` handles a universal binary's two sentinels, so the
  design does not forbid one.
- **Linux.** ASAR integrity is macOS `electron>=16` and Windows `electron>=30` only. On Linux fuse 4
  is a no-op, so a Linux package inherits a weaker posture than this profile claims. That belongs to
  the Linux packaging ticket, not here.

## Newly visible decisions and fog

- **Graduate the map's fog** "whether `forge.config.ts`'s hand-maintained list of what enters the
  package should be checked by anything" from *whether* to *how*. Yes, and the shape is settled by
  this note: one declared expectation, imported by the config that writes it and by a check that
  reads it back off the built artifact, failing by exit code. The fuse half is specified above. The
  same script should assert the other half — the asar entry list and the presence, architecture and
  signature of every `extraResource` — because that is the same class of silent failure #1743 hit,
  where Forge exited 0 and wrote a launchable app that died on its first `require`. What stays open
  is only **who runs it**, because CI is Linux-only.
- **New ticket: where the compiled helper sits in the bundle, and how it is signed and entitled.**
  `Contents/Resources` seals it as data and TN2206 names the update-mechanism hazard; it needs a
  nested-code location, inside-out signing, and its own entitlements for Bun's JIT.
- **New ticket: close the helper's own escape hatches** — the two `--no-compile-autoload-*` flags
  and stripping `BUN_OPTIONS` from the spawn environment. It could fold into the one above; it is
  sharper on its own because it is a build-flag change plus one line in the environment builder.
- **New ticket: `signPackage` must become flavor-aware** before the first `osxSign` build, or it
  will ad-hoc-sign over a Developer ID signature.
- **Open question the map should hold: the fuse and artifact gate has no automatic home.** CI is
  `ubuntu-latest`; the release workflow #1732 describes does not exist yet. Until it does, a signed
  release could be cut from an artifact nothing checked.
- **Worth a look, not yet a ticket:** moving the renderer off `file://` to a registered custom
  scheme, which is Electron's checklist item 18 and the only way fuse 7 can be disabled; and
  `sandbox: false` in `src/main.ts`, which is checklist item 4 and not a fuse question.

Nothing here contradicts a decision on the map. Two refinements: the toolchain decision named four
fuses and left `EnableCookieEncryption` to the credential design, where this note fixes all nine and
pins that one at `false` in both profiles until that design lands; and the toolchain decision's
"E2E package flavor" is given an identity here — name, bundle id, signature and updater — because a
flavor that differs only in a fuse is a flavor nothing can refuse to publish.

## Primary sources

- `apps/desktop/node_modules/@electron/fuses/dist/config.js`, `constants.js`, `index.js`, `bin.js`
  and `README.md`, at 2.1.3 — the nine indices, the four `FuseState` values, the sentinel,
  `getCurrentFuseWire`, `strictlyRequireAllFuses`, and the `resetAdHocDarwinSignature` note for
  arm64.
- `apps/desktop/node_modules/@electron-forge/plugin-fuses/dist/FusesPlugin.js`, at 7.11.2 — hooks
  `packageAfterCopy`, so fuses are flipped before signing, and computes
  `resetAdHocDarwinSignature: !hasOSXSignConfig && applePlatforms.includes(platform) && arch === 'arm64'`.
- [Electron fuses at v44.2.0](https://raw.githubusercontent.com/electron/electron/v44.2.0/docs/tutorial/fuses.md)
  and [`build/fuses/fuses.json5` at v44.2.0](https://raw.githubusercontent.com/electron/electron/v44.2.0/build/fuses/fuses.json5)
  — semantics and defaults; nine entries, schema `_version: 1`, none marked removed.
- [Electron ASAR integrity](https://www.electronjs.org/docs/latest/tutorial/asar-integrity) — the
  `ElectronAsarIntegrity` `Info.plist` key, force-termination on mismatch, macOS `>=16` and Windows
  `>=30`, and the instruction to pair the fuse with only-load-from-ASAR.
- [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security), item 19
  "Check which fuses you can change", and items 2, 3, 4 and 18 as separate runtime concerns.
- [Electron code signing](https://www.electronjs.org/docs/latest/tutorial/code-signing) — auto-update
  and `safeStorage` depend on a consistent valid signature.
- [`playwright-core/src/server/electron/electron.ts`](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/server/electron/electron.ts)
  — `['--inspect=0', '--remote-debugging-port=0', ...]`, the `Debugger listening on ws://` and
  `DevTools listening on ws://` waits, `delete env.NODE_OPTIONS`, and the loader shim that is skipped
  when `executablePath` is set.
- [Playwright `class-electron.md`](https://github.com/microsoft/playwright/blob/main/docs/src/electron-api/class-electron.md)
  — the only fuse Playwright documents: do not set `nodeCliInspect` to `false`.
- [Apple Technote 2206](https://developer.apple.com/library/archive/technotes/tn2206/_index.html) —
  standard nested-code locations, code outside them sealed as data, the update-mechanism warning, the
  prohibition on modifying a signed Mach-O, and inside-out signing order.
- [Bun single-file executables](https://bun.sh/docs/bundler/executables) and
  [`Bun.Terminal`](https://bun.com/reference/bun/Terminal) — the embedded runtime, `BUN_OPTIONS`, the
  recommended codesigning entitlements, and the PTY API the helper uses. `bun build --help` for
  `--compile-autoload-dotenv` and `--compile-autoload-bunfig`, both defaulting to on.
- Measured in this worktree at commit `374b6b3a`, macOS 25.5.0, arm64:
  `electron-fuses read --app out/Argo-darwin-arm64/Argo.app`; `plutil -p` of the packaged
  `Info.plist` and `_CodeSignature/CodeResources`; `codesign -dvvv` of the app and the helper;
  `BUN_OPTIONS="--version" ./build/argo-pty-helper`; and
  `node scripts/prove-packaged-pty.mjs --arch arm64 --skip-package`, which passed.
- `docs/research/2026-09-08-packaged-electron-toolchain-proof.md`,
  `docs/research/2026-09-08-session-process-hosts.md` (branch `research/session-process-hosts`,
  commit `bef45b57`) and `docs/research/2026-09-08-electron-desktop-toolchain.md` (branch
  `research/choose-electron-desktop-toolchain`, commit `3a5f9511`) — the posture, the acceptance
  boundary and the toolchain decision this note keeps.
