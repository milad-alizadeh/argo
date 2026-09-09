# The entitlements the Argo desktop app carries

**Date:** 2026-09-09 · **For:** [#1771](https://github.com/milad-alizadeh/argo/issues/1771), under
[#1730](https://github.com/milad-alizadeh/argo/issues/1730) · **Status:** decided; every claim
below is read off a shipping binary or an upstream source file, not inferred

## Verdict

**One entitlement, `com.apple.security.cs.allow-jit`, on the five executables that run V8. Nothing
anywhere else.** Hardened runtime everywhere, because notarization requires it. No device
entitlement, no memory or library-validation exception, and no file entitlement, because Argo is
not sandboxed and the file entitlements are App Sandbox capabilities that do nothing without it.

The set is recorded as five checked-in plists plus an `optionsForFile` that answers for **every**
path and never falls through to a default, and it is proved by reading the entitlements back off
the packaged app in the `macos-26` tier of [#1758](https://github.com/milad-alizadeh/argo/issues/1758).

Three things the ticket did not have:

- The default set is **eight keys, not six**. It also carries
  `com.apple.security.personal-information.photos-library`.
- The defaults reach **far more than the four helpers**. `@electron/osx-sign` calls
  `optionsForFile` for every Mach-O it discovers in the bundle, so the wide plist also lands on
  `chrome_crashpad_handler`, Squirrel's `ShipIt`, and every loose binary under `Resources`. In
  today's shipping Visual Studio Code that is literally true of `rg`: a grep binary signed with the
  camera and microphone entitlements.
- Of the four Electron helpers, **only three are covered by a scoped default**. The match is a
  filename substring, so the bare `Argo Helper.app` misses `(Plugin)`, `(GPU)` and `(Renderer)`
  and takes the same eight-key plist as the main app.

## The set, per signed file

Every row is hardened runtime on. "none" means an entitlements plist with an empty `<dict/>`, not
an omitted option: see the trap below.

| Signed path | Entitlements | Why |
| --- | --- | --- |
| `Argo.app/Contents/MacOS/Argo` | `cs.allow-jit` | The main process runs the app's JavaScript in V8. |
| `Frameworks/Argo Helper.app` | `cs.allow-jit` | Electron's utility processes run here, and a `utilityProcess` is Node, so V8 again. |
| `Frameworks/Argo Helper (GPU).app` | `cs.allow-jit` | What Chromium gives its own GPU helper. |
| `Frameworks/Argo Helper (Renderer).app` | `cs.allow-jit` | What Chromium gives its own renderer helper. |
| `Frameworks/Argo Helper (Plugin).app` | `cs.allow-jit` | Never launched, because Argo does not set `allowLoadingUnsignedLibraries`. Entitled as a renderer so that a path that does launch it does not fall back to an interpreter. |
| `Frameworks/Electron Framework.framework/Versions/A/Helpers/chrome_crashpad_handler` | none | Writes minidumps. It runs no JIT and touches no device. |
| `Frameworks/Squirrel.framework/Versions/A/Resources/ShipIt` | none | Moves a directory. |
| `node-pty`'s `spawn-helper` | none | `forkpty` and `execve`. Neither is restricted by the hardened runtime. |
| `pty.node`, and any other `.node` | none | Entitlements on a dylib are inert. Apple: "You add entitlements only to executables. Shared libraries, frameworks, and in-process plug-ins inherit the entitlements of their host executable." |

`cs.` is short for `com.apple.security.cs.` throughout.

### What is deliberately absent

- **`cs.allow-unsigned-executable-memory`.** Apple scopes it to overriding or patching C code, the
  deprecated `NSCreateObjectFileImageFromMemory`, and DVDPlayback. Chromium's own renderer
  entitlements are `allow-jit` alone, so modern V8 does not need it. Every Electron app that
  carries it on the main executable copied it from another Electron app; `cmux`, installed here,
  carries it today.
- **`cs.disable-library-validation`.** Library validation permits code "signed by Apple or signed
  with the same Team ID as the main executable". `@electron/osx-sign` signs every Mach-O in the
  bundle with Argo's own identity, `pty.node` included, so nothing Argo loads is a different team.
  Apple also notes Gatekeeper runs extra checks on programs that disable it, so carrying it is a
  cost and not merely noise.
- **The seven device and personal-information keys.** They are Chrome's, and Chrome is a browser
  that genuinely wants a camera. Argo is a cockpit for terminal Sessions.
- **`security.automation.apple-events`.** VS Code and `cmux` carry it. Argo spawns CLIs with
  `execve` through `node-pty` and drives no other application by AppleEvent.
- **Every `security.files.*` key.** Apple documents them as App Sandbox capabilities. Argo is not
  sandboxed, so they grant nothing.

### The one plausible addition

`com.apple.security.device.audio-input`, if voice input ever reaches the cockpit. It has to arrive
together with an `NSMicrophoneUsageDescription`, and it is the only key on the removed list with a
route back.

## The directories Argo reads

**No entitlement, and none available.** Argo reads git repositories and CLI transcripts under the
user's home. Without the sandbox there is nothing to grant, and with TCC there is nothing an
entitlement can do: consent is the user's, at first access, per protected location.

What follows from that is an `Info.plist` question rather than an entitlements one. TCC guards
Desktop, Documents, Downloads, removable volumes and network volumes. `~/.claude` and
`~/.codex` are not guarded, so transcript reading prompts for nothing, but a user's repositories
commonly sit in `~/Documents` or on an external disk, and the prompt the user sees is Argo's.

Ship these, all five, so no prompt arrives with an empty reason:

`NSDesktopFolderUsageDescription`, `NSDocumentsFolderUsageDescription`,
`NSDownloadsFolderUsageDescription`, `NSRemovableVolumesUsageDescription`,
`NSNetworkVolumesUsageDescription`.

One consequence worth holding, because it is the sharpest thing in this section. TCC resolves a
request to a **responsible process**, and a child inherits its parent's grant. A `claude` or
`codex` process Argo spawns therefore reads the user's Documents under **Argo's** grant, and the
one prompt the user ever sees names Argo. Argo's usage string is the entire explanation the user
gets before an agent reads a directory, so it has to describe the agent's reading and not Argo's.

## What records the set

Three parts, because no one of them holds on its own.

1. **Five plists in the repo**, one per role, plus an empty-dict plist for the executables that get
   nothing. The set is then a diff in a pull request rather than a property of a dependency.
2. **An `optionsForFile` that answers for every path.** It must return an `entitlements` path for
   every file it is asked about, with no fall-through branch. A path it does not answer for takes
   `@electron/osx-sign`'s default, which is exactly the widening this ticket is about.
3. **A read-back gate** in the `macos-26` tier of #1758. Walk every Mach-O in the packaged
   `Argo.app`, run `codesign -d --entitlements - --xml`, and fail on any key outside the recorded
   allowlist. This is the entitlements analogue of the `getCurrentFuseWire` check that
   [#1757](https://github.com/milad-alizadeh/argo/issues/1757) chose for fuses, and it exists for
   the same reason: the config states an intent, and only the artifact states the fact.

The gate is the load-bearing part. A missing `allow-jit` **exits 0 and costs 82x**, measured in
[#1759](https://github.com/milad-alizadeh/argo/issues/1759), so a silently wrong entitlement set is
this repo's known failure shape, not a hypothetical one.

It is also the part the ticket's phrase "the next `osx-sign` upgrade" understates. There is no
upgrade step to review: `@electron/packager` 20.3.0 depends on `@electron/osx-sign` at **`^2.2.0`**,
a floating minor range, so a new default plist arrives on an ordinary lockfile refresh. Nothing in
Forge's config surface mentions entitlements, so without parts 2 and 3 the widening would land in a
dependency bump that reads as noise.

### The trap in `optionsForFile`

`mergeOptionsForFile` overrides the default only when `opts.entitlements !== undefined`. Returning
`{}`, or returning an object whose `entitlements` is `undefined`, silently restores the eight-key
default for that file. "No entitlements" has to be spelled as a real empty-dict plist, or as
`entitlements: []`, which the array branch builds into an empty dict in a temp file. The same merge
keeps `hardenedRuntime: true` from the defaults, so returning `entitlements` alone is enough and
the hardened runtime is not lost.

## Measurements

Read on macOS 26 (Darwin 25.5.0), arm64, 2026-09-09, with
`codesign -d --entitlements - --xml <path> | plutil -convert xml1 -o - -`.

**`@electron/osx-sign` 2.7.0**, the current release, `dist/sign.js`:

| Plist | Selected when the path contains | Keys |
| --- | --- | --- |
| `default.darwin.plist` | anything else, main app included | `cs.allow-jit`, `device.audio-input`, `device.bluetooth`, `device.camera`, `device.print`, `device.usb`, `personal-information.location`, `personal-information.photos-library` |
| `default.darwin.renderer.plist` | `(Renderer).app` | `cs.allow-jit` |
| `default.darwin.gpu.plist` | `(GPU).app` | `cs.allow-jit` |
| `default.darwin.plugin.plist` | `(Plugin).app` | `cs.allow-jit`, `cs.allow-unsigned-executable-memory`, `cs.disable-library-validation` |

**Google Chrome 152.0.7977.83**, the app the defaults were copied from:

| Binary | Keys, ignoring provisioning keys |
| --- | --- |
| `Google Chrome.app` | the seven device and personal-information keys, and **no `allow-jit`** |
| `Google Chrome Helper.app` | **none at all** |
| `Google Chrome Helper (GPU).app` | `cs.allow-jit` |
| `Google Chrome Helper (Renderer).app` | `cs.allow-jit` |
| `(Plugin)` helper | **not shipped.** Chrome 152 has no `(Plugin)` helper, and `helper-plugin-entitlements.plist` is gone from `chrome/app` upstream. `@electron/osx-sign`'s comment cites a file that no longer exists. |

**Visual Studio Code 1.96.2**, the closest precedent: an Electron app that ships `node-pty` and is
notarized. It hand-writes the main executable and takes the three scoped defaults.

| Binary | Keys |
| --- | --- |
| `Visual Studio Code.app` | `automation.apple-events`, `cs.allow-jit`, `device.audio-input`, `device.camera` |
| `Code Helper.app` | the same four |
| `Code Helper (Renderer).app` | `cs.allow-jit` |
| `Code Helper (GPU).app` | `cs.allow-jit` |
| `Code Helper (Plugin).app` | `cs.allow-jit`, `cs.allow-unsigned-executable-memory`, `cs.disable-library-validation` |
| `chrome_crashpad_handler` | the same four as the main app |
| `Squirrel.framework/…/ShipIt` | the same four |
| `node_modules/@vscode/ripgrep/bin/rg` | the same four |
| `node-pty/build/Release/spawn-helper` | the same four |
| `node-pty/build/Release/pty.node` | the same four, and inert |

The last five rows are the finding. They are not helpers and not `.app` bundles; they take the
top-level set because the signing walk reaches every Mach-O. Note also that **VS Code's main
executable carries no `disable-library-validation`** while loading `pty.node`, `kerberos.node`,
`vscode-sqlite3.node` and a dozen more, which is the same-Team-ID rule working.

Every executable in that bundle, for the shape of the inventory the gate has to walk:

```
MacOS/Electron
Resources/app/bin/code-tunnel
Resources/app/node_modules/@vscode/vsce-sign/bin/vsce-sign
Resources/app/node_modules/@vscode/ripgrep/bin/rg
Resources/app/node_modules/node-pty/build/Release/spawn-helper
Frameworks/Electron Framework.framework/Versions/A/Helpers/chrome_crashpad_handler
Frameworks/Squirrel.framework/Versions/A/Resources/ShipIt
Frameworks/Code Helper.app/Contents/MacOS/Code Helper
Frameworks/Code Helper (GPU).app/Contents/MacOS/Code Helper (GPU)
Frameworks/Code Helper (Plugin).app/Contents/MacOS/Code Helper (Plugin)
Frameworks/Code Helper (Renderer).app/Contents/MacOS/Code Helper (Renderer)
```

Two more, read for contrast rather than for guidance. **Claude 1.49585.0** carries the whole eight-key
default plus `security.virtualization`, which is the "took the defaults" pattern this ticket
names, in a shipping app. **cmux 0.64.19** carries `cs.allow-unsigned-executable-memory` and
`cs.disable-library-validation` on its main executable, which is the copied-from-another-Electron-app
pattern.

## Sources

| Source | What it settled | Link |
| --- | --- | --- |
| `@electron/osx-sign` 2.7.0, `dist/sign.js` and `entitlements/` | The eight-key default, the substring match, the per-file walk, the merge trap | [npm](https://www.npmjs.com/package/@electron/osx-sign) |
| `@electron/packager` 20.3.0 manifest | Depends on `@electron/osx-sign` at `^2.2.0`, so the default set floats | [npm](https://registry.npmjs.org/@electron/packager/latest) |
| Chromium `chrome/app/app-entitlements.plist` | The seven device keys are Chrome's | [source](https://raw.githubusercontent.com/chromium/chromium/main/chrome/app/app-entitlements.plist) |
| Chromium `chrome/app/helper-renderer-entitlements.plist` | A modern renderer needs `allow-jit` alone | [source](https://raw.githubusercontent.com/chromium/chromium/main/chrome/app/helper-renderer-entitlements.plist) |
| Chromium `chrome/app` directory listing | `helper-plugin-entitlements.plist` and `helper-entitlements.plist` no longer exist | [API listing](https://api.github.com/repos/chromium/chromium/contents/chrome/app?ref=main) |
| Apple, Hardened Runtime | "use only the entitlements that are absolutely necessary"; entitlements on a dylib are inert | [docs](https://developer.apple.com/documentation/security/hardened-runtime) |
| Apple, `disable-library-validation` | Same Team ID or Apple; Gatekeeper penalises disabling it | [docs](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.cs.disable-library-validation) |
| Apple, `allow-unsigned-executable-memory` | Scoped to patching C code, `NSCreateObjectFileImageFromMemory`, DVDPlayback | [docs](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.cs.allow-unsigned-executable-memory) |
| Apple, `allow-jit` | `MAP_JIT`; without it, JIT falls back to an interpreter or crashes | [docs](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.cs.allow-jit) |
| Apple, `com.apple.security.files.user-selected.read-write` | An App Sandbox capability, so inert unsandboxed | [docs](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.files.user-selected.read-write) |
| Electron, `utilityProcess` | The Plugin helper hosts the utility process only under `allowLoadingUnsignedLibraries` | [docs](https://www.electronjs.org/docs/latest/api/utility-process) |
| Qt, "The Curious Case of the Responsible Process" | TCC resolves to a responsible process and a child inherits the parent's grant | [blog](https://www.qt.io/blog/the-curious-case-of-the-responsible-process) |
| Installed binaries: Chrome 152, VS Code, Claude, cmux | Every measurement above | read locally with `codesign -d` |

Dead ends, recorded so the next reader does not repeat them:

| Dead end | What happened |
| --- | --- |
| `developer.apple.com/documentation/...` through a plain page fetch | Renders client-side. Every entitlement page returns a title and no body. The JSON behind it, `developer.apple.com/tutorials/data/documentation/<path>.json`, returns the full prose and is what the quotes above come from. |
| Electron's own code-signing tutorial | Names `@electron/osx-sign` and no entitlement at all. It settles nothing about the defaults. |
| `chrome/app/helper-entitlements.plist` | 404. There is no such file: Chrome's plain helper is signed with no entitlements rather than with an empty list. |
