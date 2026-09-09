# The entitlements the Argo desktop app carries

**Date:** 2026-09-09 · **For:** [#1771](https://github.com/milad-alizadeh/argo/issues/1771), under
[#1730](https://github.com/milad-alizadeh/argo/issues/1730) · **Status:** decided; every claim
below is read off a shipping binary or an upstream source file, with the single stated exception of
the plain helper's row, which is an assumption a packaged run settles

## Verdict

**One entitlement, `com.apple.security.cs.allow-jit`, on the four executables that run V8. Nothing
anywhere else.** Hardened runtime everywhere, because notarization requires it. No device
entitlement, no memory or library-validation exception, and no file entitlement, because Argo is
not sandboxed and the file entitlements are App Sandbox capabilities that do nothing without it.

The set is recorded as **two** plists in the repo, `allow-jit.plist` and `none.plist`, plus an
`optionsForFile` that is a total function over every path `@electron/osx-sign` hands it, and it is
proved by reading the entitlements back off the packaged app in the `macos-26` tier of
[#1758](https://github.com/milad-alizadeh/argo/issues/1758).

**Scope correction.** #1771 excludes the compiled Bun PTY helper as already settled by
[#1759](https://github.com/milad-alizadeh/argo/issues/1759). That carve-out is void:
[#1791](https://github.com/milad-alizadeh/argo/issues/1791) voids #1759 and makes `node-pty` the
PTY host, so no Bun binary ships and there is nothing the ticket's exclusion still points at.
`node-pty`'s `spawn-helper` and `pty.node` take its place below, and both get nothing.

Three things the ticket did not have:

- The default set is **eight keys, not six**. Beyond the six the ticket named it also carries
  `com.apple.security.personal-information.photos-library` and `com.apple.security.cs.allow-jit`.
- The defaults reach **far more than the four helpers**. `@electron/osx-sign` calls
  `optionsForFile` for every path its signing walk yields, which is every file `isbinaryfile`
  calls binary plus every `.app` and `.framework` directory. So the wide plist also lands on
  `chrome_crashpad_handler`, Squirrel's `ShipIt`, the Chromium dylibs, and every loose binary
  under `Resources`. In today's shipping Visual Studio Code that is literally true of `rg`: a grep
  binary signed with the camera and microphone entitlements.
- Of the four Electron helpers, **only three are covered by a scoped default**. The match is a
  filename substring, so the bare `Argo Helper.app` misses `(Plugin)`, `(GPU)` and `(Renderer)`
  and takes the same eight-key plist as the main app.

## The set, per signed file

Every row is hardened runtime on. "none" means an entitlements plist with an empty `<dict/>`, not
an omitted option: see the trap below. The last row is a catch-all rather than a leftover, and it
is what makes the function total.

| Signed path | Entitlements | Why |
| --- | --- | --- |
| `Argo.app/Contents/MacOS/Argo` | `cs.allow-jit` | The main process runs the app's JavaScript in V8. |
| `Frameworks/Argo Helper.app` | `cs.allow-jit` | A `utilityProcess` runs Node here by default, so V8 again. See the note below. |
| `Frameworks/Argo Helper (GPU).app` | `cs.allow-jit` | What Chromium gives its own GPU helper. |
| `Frameworks/Argo Helper (Renderer).app` | `cs.allow-jit` | What Chromium gives its own renderer helper. |
| `Frameworks/Argo Helper (Plugin).app` | none | Reachable only through `allowLoadingUnsignedLibraries`, which Argo does not set. Setting that flag is the one change that reopens this row, and it would want the two exceptions this document refuses, not `allow-jit`. |
| `Frameworks/Electron Framework.framework/Versions/A/Helpers/chrome_crashpad_handler` | none | Writes minidumps. It runs no JIT and touches no device. |
| `Frameworks/Squirrel.framework/Versions/A/Resources/ShipIt` | none | Moves a directory. |
| `node-pty`'s `spawn-helper` | none | `forkpty` and `execve`. Neither is restricted by the hardened runtime. |
| Every framework bundle, every `.dylib`, every `.node`, and every other path the walk yields | none | Entitlements on a dylib are inert. Apple: "You add entitlements only to executables. Shared libraries, frameworks, and in-process plug-ins inherit the entitlements of their host executable." Inert is not the same as unrecorded, though: VS Code's `libffmpeg.dylib` and `pty.node` both carry its camera and microphone keys today. |

`cs.` is short for `com.apple.security.cs.` throughout.

**The plain helper is the one row a packaged run has to confirm.** Electron picks the helper in
`electron_api_utility_process.cc`: `allowLoadingUnsignedLibraries` sets `use_plugin_helper`, and
without it the child flag is `content::ChildProcessHost::CHILD_NORMAL`, the bare `Helper.app`. A
`utilityProcess` is Node, so it JITs. Chrome gives its own plain helper nothing, because
Chromium's own services in it do not JIT, and `apps/desktop` does not exist yet, so whether Argo
ever forks a `utilityProcess` is not yet a fact. `allow-jit` is the assumption here, because
Argo's main-process work is the kind that moves off the main thread. If the first packaged
acceptance run forks none, this row drops to none with the rest.

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

1. **Two plists in the repo.** There are only two distinct bodies, `{allow-jit}` and `{}`, so
   `allow-jit.plist` and `none.plist` are the whole record. The set is then a diff in a pull
   request rather than a property of a dependency.
2. **An `optionsForFile` that is total.** `@electron/osx-sign`'s `walk` yields every file
   `isbinaryfile` calls binary plus every `.app` and `.framework` directory, and `sign.js` calls
   `optionsForFile` for each of those and for `opts.app`. That set is far wider than the
   executables: it takes in `.dylib`, `.node`, `.icns`, `.pak`, `.asar` and the bundle directories.
   So the function needs an unconditional `return { entitlements: NONE }` at the end, not a chain
   of `if`s. A path it does not answer for takes the eight-key default, which is exactly the
   widening this ticket is about.
3. **A read-back gate** in the `macos-26` tier of #1758. Walk the packaged `Argo.app` the same way
   `osx-sign` does, run `codesign -d --entitlements - --xml` on every path that carries a
   signature, and fail on any key outside the recorded allowlist. Walking only the executables
   would miss the dylibs and `.node` files, which are the paths a fall-through regresses first.
   This is the entitlements analogue of the `getCurrentFuseWire` check that
   [#1757](https://github.com/milad-alizadeh/argo/issues/1757) chose for fuses, and it exists for
   the same reason: the config states an intent, and only the artifact states the fact.

The gate is the load-bearing part, and the reason is the dependency range rather than any reading
Argo holds. The nearest measurement, **a missing `allow-jit` exiting 0 while costing 82x**, was
taken in [#1759](https://github.com/milad-alizadeh/argo/issues/1759) on a `bun build --compile`
binary. #1791 voids that ticket and Argo ships no such binary, and the epic is explicit that its
findings "remain true about Bun and no longer apply to Argo". No equivalent reading exists for V8
under Electron. So the number is the right *shape* to fear, a wrong entitlement that is silent and
expensive, and it is not evidence about this artifact.

The gate's actual justification is the part the ticket's phrase "the next `osx-sign` upgrade" understates. There is no
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
| `Electron Framework.framework/…/Libraries/libffmpeg.dylib` | the same four, and inert |

The last six rows are the finding. They are not helpers and not `.app` bundles, and the last two
are not even executables; they take the top-level set because the signing walk reaches far past
the helpers. Note also that **VS Code's main executable carries no `disable-library-validation`**
while loading `pty.node`, `kerberos.node`, `vscode-sqlite3.node` and a dozen more, which is the
same-Team-ID rule working.

The executables in that bundle, which are only part of what the gate has to walk. The dylibs
above, every `.node`, and the four framework bundles are signed too and are not in this list:

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

Two more, read for contrast rather than for guidance. **Claude 1.49585.0** carries the whole
eight-key default plus `automation.apple-events` and `security.virtualization`, which is the "took
the defaults" pattern this ticket names, in a shipping app. **cmux 0.64.19** carries
`cs.allow-unsigned-executable-memory` and
`cs.disable-library-validation` on its main executable, which is the copied-from-another-Electron-app
pattern.

## Sources

| Source | What it settled | Link |
| --- | --- | --- |
| `@electron/osx-sign` 2.7.0, `dist/sign.js` and `entitlements/` | The eight-key default, the substring match, the merge trap | [npm](https://www.npmjs.com/package/@electron/osx-sign) |
| `@electron/osx-sign` 2.7.0, `dist/util.js` `walk()` | What `optionsForFile` is called for: `isBinaryFile`, not Mach-O detection, plus every `.app` and `.framework` directory | same package |
| `@electron/packager` 20.3.0 manifest | Depends on `@electron/osx-sign` at `^2.2.0`, so the default set floats | [npm](https://registry.npmjs.org/@electron/packager/latest) |
| Chromium `chrome/app/app-entitlements.plist` | The seven device keys are Chrome's | [source](https://raw.githubusercontent.com/chromium/chromium/main/chrome/app/app-entitlements.plist) |
| Chromium `chrome/app/helper-renderer-entitlements.plist` | A modern renderer needs `allow-jit` alone | [source](https://raw.githubusercontent.com/chromium/chromium/main/chrome/app/helper-renderer-entitlements.plist) |
| Chromium `chrome/app` directory listing | `helper-plugin-entitlements.plist` and `helper-entitlements.plist` no longer exist | [API listing](https://api.github.com/repos/chromium/chromium/contents/chrome/app?ref=main) |
| Apple, Hardened Runtime | "use only the entitlements that are absolutely necessary"; entitlements on a dylib are inert | [docs](https://developer.apple.com/documentation/security/hardened-runtime) |
| Apple, `disable-library-validation` | Same Team ID or Apple; Gatekeeper penalises disabling it | [docs](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.cs.disable-library-validation) |
| Apple, `allow-unsigned-executable-memory` | Scoped to patching C code, `NSCreateObjectFileImageFromMemory`, DVDPlayback | [docs](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.cs.allow-unsigned-executable-memory) |
| Apple, `allow-jit` | `MAP_JIT`; without it, JIT falls back to an interpreter or crashes | [docs](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.cs.allow-jit) |
| Apple, `com.apple.security.files.user-selected.read-write` | An App Sandbox capability, so inert unsandboxed | [docs](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.files.user-selected.read-write) |
| Electron, `shell/browser/api/electron_api_utility_process.cc` | `allowLoadingUnsignedLibraries` sets `use_plugin_helper`; without it the child flag is `CHILD_NORMAL`, the plain `Helper.app`. This is what the plain-helper and Plugin-helper rows rest on, not the docs page. | [source](https://raw.githubusercontent.com/electron/electron/main/shell/browser/api/electron_api_utility_process.cc) |
| Electron, `utilityProcess` docs | Corroborates the flag, and is silent on the default host | [docs](https://www.electronjs.org/docs/latest/api/utility-process) |
| Qt, "The Curious Case of the Responsible Process" | TCC resolves to a responsible process and a child inherits the parent's grant | [blog](https://www.qt.io/blog/the-curious-case-of-the-responsible-process) |
| Installed binaries: Chrome 152, VS Code, Claude, cmux | Every measurement above | read locally with `codesign -d` |

Dead ends, recorded so the next reader does not repeat them:

| Dead end | What happened |
| --- | --- |
| `developer.apple.com/documentation/...` through a plain page fetch | Renders client-side. Every entitlement page returns a title and no body. The JSON behind it, `developer.apple.com/tutorials/data/documentation/<path>.json`, returns the full prose and is what the quotes above come from. |
| Electron's own code-signing tutorial | Names `@electron/osx-sign` and no entitlement at all. It settles nothing about the defaults. |
| `chrome/app/helper-entitlements.plist` | 404. There is no such file: Chrome's plain helper is signed with no entitlements rather than with an empty list. |
