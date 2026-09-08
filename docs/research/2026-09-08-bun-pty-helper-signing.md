# Signing and entitling the compiled Bun PTY helper

**Date:** 2026-09-08 · **For:** [Decide how the compiled Bun PTY helper is signed and entitled](https://github.com/milad-alizadeh/argo/issues/1759),
building on [prove a packaged Electron app](https://github.com/milad-alizadeh/argo/issues/1743) and
[the update mechanism](https://github.com/milad-alizadeh/argo/issues/1746) ·
**Status:** every load-bearing claim measured locally on macOS 26.5.2 (build 25F84), Apple docs
verified against raw sources rather than a summariser

## The answer

1. **Position — move it to `Contents/Helpers/argo-pty-helper`.** That is the position `codesign`
   seals as nested code. Measured in a controlled fixture: the same byte-identical helper placed in
   both positions came out as `['cdhash', 'requirement']` under `Contents/Helpers/` and `['hash2']`
   under `Contents/Resources/`. `extraResource` cannot put it there — it is Resources-only in
   packager's source — so the move needs one `afterCopyExtraResources` hook.
2. **Entitlements — hardened runtime plus exactly one entitlement,
   `com.apple.security.cs.allow-jit`.** Measured: the helper under hardened runtime with *no*
   entitlements still runs, but its hot loop takes **4290 ms** against **52 ms** with `allow-jit`
   — an 82x silent regression that matches the JIT-disabled reference run (4274 ms) to within
   noise. The other four entitlements Bun's own binary carries change the timing by nothing.
   Spawning a child needs **no** entitlement at all. `com.apple.security.inherit` is a sandbox
   mechanism and does not apply; the helper needs its own standalone entitlements, not inheritance,
   and must not be sandboxed.
3. **Notarization — the helper needs its own Developer ID signature, hardened runtime, a secure
   timestamp, and no `get-task-allow`; it gets no ticket of its own.** `stapler` cannot staple to a
   bare Mach-O. The app's ticket covers it, because "a ticket contains a list of the code signatures
   for executables within a supported file format".
4. **Update integrity — TN2206's warning does not apply to Argo, and would not apply even if the
   helper stayed in `Resources`.** Squirrel.Mac replaces the whole `Contents` directory with an
   atomic `rename()`. The warning is about an updater that replaces nested files *inside* a bundle
   whose outer signature stays behind. Argo's updater never does that. Position is still worth
   changing — for correctness, verification cost and honest sealing — but not for update safety.

## A finding that changes the ticket: the helper is not always signable

**`bun build --compile` shipped a version window in which the output cannot be code-signed at all.**
This is not in the ticket's premises and it is the thing most likely to break a release.

Measured on this machine, same 17-byte input script, two Bun versions:

| Bun | file size | signature ends at | trailing bytes | `codesign -v` as built | `codesign -f -s -` |
|---|---|---|---|---|---|
| 1.3.13 (local, no `--target`) | 63,072,928 | 63,053,602 | **19,326** | `invalid signature (code or signature have been modified)` | **REFUSED** |
| 1.3.13 (local, `--target=bun-darwin-arm64`) | 63,072,928 | 63,053,602 | **19,326** | invalid | **REFUSED** |
| 1.4.2 (the repo's pin, real `build/argo-pty-helper`) | 62,226,930 | 62,226,930 | **0** | `valid on disk` | **OK** |

On 1.3.13 every signing attempt fails with:

```
main executable failed strict validation
```

regardless of identity (ad-hoc or Developer ID), of `--options runtime`, and of which entitlements
file is passed. `codesign --remove-signature` cannot even strip it — it returns `internal error in
Code Signing subsystem` and leaves the file byte-identical.

**Why.** The Mach-O segment map shows `__LINKEDIT` at fileoff 62,357,504 + filesize 696,098 =
63,053,602, and `LC_CODE_SIGNATURE` at dataoff 62,564,688 + datasize 488,914 = 63,053,602 — the
signature ends exactly where the last segment ends, but the file is 19,326 bytes longer. Of those
trailing bytes, 10,121 are non-zero, and `strings` over them yields `7FRXF46ZSN` and a plist
containing `com.apple.security.cs.allow-jit`, `…allow-unsigned-executable-memory`,
`…disable-executable-page-protection`, `…allow-dyld-environment-variables` and
`…disable-library-validation`. That is **Bun's own Developer ID signature and entitlements**,
orphaned past the end of the segment `bun build --compile` recorded. Data beyond the last segment
is what `codesign` rejects.

Bun's own tracker records this. Issue
[#29120](https://github.com/oven-sh/bun/issues/29120), "bun build --compile
--target=bun-darwin-arm64 produces truncated code signature in v1.3.12", closed 2026-04-14, and PR
[#29272](https://github.com/oven-sh/bun/pull/29272), "fix(macho): size __LINKEDIT and
LC_CODE_SIGNATURE to MachoSigner's output", **merged** 2026-04-14. A duplicate report,
[#29276](https://github.com/oven-sh/bun/issues/29276), carries a version matrix saying v1.3.7 and
v1.3.11 sign fine and v1.3.12 does not.

**Two things do not line up, and I am reporting them rather than smoothing them.** PR #29272 merged
2026-04-14; bun-v1.3.13 was published 2026-04-20 (from the GitHub releases API); yet I measure
1.3.13 as still broken. So either the fix missed the 1.3.13 cut or it did not cover this path.
Separately, #29276's reported error string is `invalid or unsupported format for signature` and mine
is `main executable failed strict validation` — same class of defect, different surface, possibly a
macOS version difference (I am on 26.5.2, they were on 26.4).

**Two workarounds, both measured to work on the broken 1.3.13:**

- `BUN_NO_CODESIGN_MACHO_BINARY=1 bun build --compile …` → trailing bytes 0, re-signs cleanly, runs.
  The string `BUN_NO_CODESIGN_MACHO_BINARY` is present in the 1.3.13 binary. With it set, Bun leaves
  the inherited signature alone (`CodeDirectory … size=489135 flags=0x10000(runtime)`, identical to
  the stock `bun` binary's), which `codesign` can then replace.
- Truncate the file to `LC_CODE_SIGNATURE.dataoff + datasize`, then sign. Verified: `valid on disk`,
  `satisfies its Designated Requirement`, and the helper still runs — the `__BUN` payload segment
  sits at fileoff 62,341,120, comfortably inside the truncation point, so nothing is lost.

**Recommendation.** The pin `bun@1.4.2` in the root `package.json` is load-bearing for signability,
and nothing currently says so. Add a build-time assertion after `bun build --compile` and before
signing: the compiled helper must have zero bytes after `LC_CODE_SIGNATURE`, and `codesign -v` on it
must pass. That is a two-line check that converts a silent release-blocking regression into a build
failure with a name. Do not rely on a Bun version comparison — assert the property, not the version.

## 1. Position

**Recommendation: `Contents/Helpers/argo-pty-helper`.**

### What each position is sealed as

The authoritative list is not prose — it is the `rules2` dictionary `codesign` writes into the
signature it creates. Extracted from my own signed fixture:

```
^(Frameworks|SharedFrameworks|PlugIns|Plug-ins|XPCServices|Helpers|MacOS|Library/(Automator|Spotlight|LoginItems))/
    nested: true, weight: 10.0
^[^/]+$
    nested: true, weight: 10.0
```

Anything matching those is a nested-code candidate; everything else is sealed as data. `Resources/`
does not match. `Helpers/` does.

`man codesign` on this machine gives the same set as prose, under `--deep`: "The codesign tool will
only discover nested code content in the following directories: Contents, Contents/Frameworks,
Contents/SharedFrameworks, Contents/PlugIns, Contents/Plug-ins, Contents/XPCServices,
Contents/Helpers, Contents/MacOS, Contents/Library/Automator, Contents/Library/Spotlight,
Contents/Library/LoginItems", and: "If any code (Mach-Os, bundles) are located outside the above
listed locations they will not be signed by the `--deep` option."

TN2206's Table 3 gives a near-identical list but is **not** byte-identical to either: it adds
`Contents/Library/LaunchServices` ("Privileged helper tools installed by the ServiceManagement
framework") and omits `Contents/SharedFrameworks` and `Contents/Plug-ins`. Where they disagree,
`rules2` is what the tool actually applied, so that is what I have used. The disagreement is also
evidence the three sources are independent rather than one echoing another.

TN2206 states the consequence directly:

> These places are expected to contain **only** code. Putting arbitrary data files there will cause
> them to be rejected (since they're unsigned). Conversely, putting code into other places will
> cause it to be sealed as data (resource) files. This causes this code to be sealed twice; once in
> the nested code, and once in the outer signature. This wastes both signing and verification time
> and storage space. Also, this can break the outer signature of apps that use their own update
> mechanisms to replace nested code. If this nested code is being treated as resources, the outer
> signature doesn't know that this nested content is actually code. Always put code and data into
> their proper places.

I verified that passage against the raw HTML with `curl` and a tag-stripping script, not a
summariser — the sentences above are present verbatim, one occurrence each.

### Measured, per position

A fixture app (`Fixture.app`, real `Info.plist`, a compiled C main executable) with the *same*
truncated-and-signable Bun helper copied into two positions, each inner binary signed first and the
bundle signed last:

```
Helpers/argo-pty-helper      keys=['cdhash', 'requirement']
Resources/argo-pty-helper    keys=['hash2']
```

`codesign -d --deep -vv Fixture.app` reports `Nested=Helpers/argo-pty-helper` and does not mention
the Resources copy. `codesign --verify --deep --strict -vv` emits `--prepared:` and `--validated:`
lines for the Helpers copy only; the Resources copy is checked as a hash, never recursively.

The recorded requirement for the nested entry:

```
identifier "com.argo.fixture.pty-helper" and anchor apple generic
  and certificate leaf[subject.CN] = "Apple Development: Milad Alizadeh (3DP93359T5)"
  and certificate 1[field.1.2.840.113635.100.6.2.1] /* exists */
```

Note it pins the **signing identifier** and the **leaf certificate**. Whatever replaces the helper
must keep the same `-i` identifier and the same Developer ID. (My cert is an Apple Development one,
so a real Developer ID signature's requirement will name `subject.OU`/the team differently; the
shape — identifier plus anchor plus leaf constraint — is the same.)

### Corroboration from shipped apps

Across seven installed apps I counted how many `Contents/Resources/…` entries in the outer
`CodeResources` carry a `cdhash`:

| App | `Resources/` entries | with `cdhash` |
|---|---|---|
| Visual Studio Code | 2,519 | 0 |
| Cursor | 16,770 | 0 |
| LM Studio | 24,566 | 0 |
| Claude | 3,148 | 0 |
| Slack | 85 | 0 |
| Notion | 11 | 0 |
| Docker | 47 | 0 |

**Zero out of 47,146.** `Contents/Resources` is never nested code, in any shipped app I can reach.
This independently reproduces #1743's measurement.

**Claude.app is the direct precedent for the recommendation.** It ships four bare Mach-O helpers and
one nested `.app` in `Contents/Helpers/`:

```
Helpers/app-cu-helper        keys=['cdhash', 'requirement']
Helpers/chrome-native-host   keys=['cdhash', 'requirement']
Helpers/disclaimer           keys=['cdhash', 'requirement']
Helpers/permission-fixer     keys=['cdhash', 'requirement']
Helpers/Claude iOS Sim.app   keys=['cdhash', 'requirement']
```

Each is `Developer ID Application: Anthropic PBC (Q6L2SF6YDW)`, `flags=0x10000(runtime)`, with a
`Timestamp=` line — and an **empty** entitlements dictionary. So a bare Mach-O in `Contents/Helpers`
is a shipped, notarized, real-world pattern, not a theory.

### Why not the alternatives

- **`Contents/MacOS/`** — is sealed as nested code, so it would work. But it is where the bundle's
  main executable lives and where Electron/packager renames `Electron` → `Argo`. Putting a second,
  unrelated Mach-O beside the app's own entry point invites confusion with no benefit over
  `Helpers/`, which TN2206 labels precisely "Helper apps and tools".
- **`Contents/Frameworks/<name>.app`** — a full bundled helper app. Correct but heavier: an
  `Info.plist`, a `CFBundleExecutable`, a bundle identifier, and it lands in the directory Electron
  owns for its own four helpers and its frameworks. Only worth it if the helper needs a bundle
  identity — its own TCC prompts, its own Info.plist keys, its own login-item registration. The PTY
  helper needs none of that today.
- **`Contents/Library/`** — `Contents/Library` *itself* is not in the nested list. Only the three
  named subdirectories are (`Automator`, `Spotlight`, `LoginItems`), and each carries a specific
  system meaning the PTY helper does not have.
- **`Contents/Resources/`** — status quo; sealed as data, as measured above.

### Hazard: `Contents/Helpers/` must contain only code

TN2206's "expected to contain only code" is enforced, and it fails the **outer** signing, not the
helper's. Measured on the fixture:

| `Contents/Helpers/` contains | outer `codesign` |
|---|---|
| only `argo-pty-helper` | **SIGN OK** |
| plus a data file `config.json` | **FAIL** |
| plus a non-bundle subdirectory `stuff/x.txt` | **FAIL** |

The failure reads:

```
Fixture.app: code object is not signed at all
In subcomponent: …/Fixture.app/Contents/Helpers/config.json
```

which names a *file*, not the real rule, and so is easy to misdiagnose. If the helper ever grows a
sidecar — a config, a manifest, a second payload — that file goes in `Resources`, never beside the
helper.

### What Forge and `@electron/osx-sign` do without custom code

Read from `node_modules`, `@electron/osx-sign` 1.3.3, `@electron/packager` 18.4.4,
`@electron-forge/core` (the versions this repo has installed).

- **`extraResource` is Resources-only.** `@electron/packager/dist/platform.js:222` copies each
  entry to `path.resolve(this.stagingPath, this.resourcesDir, path.basename(resource))`, and
  `dist/mac.js:58` defines `resourcesDir` as `path.join(this.dotAppName, 'Contents', 'Resources')`.
  There is no `extraResource`-like option for any other directory. So the current
  `extraResource: HELPER_OUTPUT` **cannot** be pointed at `Contents/Helpers`.
- **osx-sign already signs the helper wherever it is.** `sign.js` calls
  `walkAsync(getAppContentsPath(opts))`, which recurses the whole of `Contents/` and returns every
  path `isBinaryFile()` accepts. A Mach-O in `Resources` is found and signed. What it *cannot* do is
  change how the outer signature seals it — that is `codesign`'s rules, not osx-sign's.
- **The default entitlements are too broad.** `defaultOptionsForFile` in `sign.js` matches only on
  `(Plugin).app`, `(GPU).app` and `(Renderer).app` in the path; everything else, including our
  helper, gets `entitlements/default.darwin.plist`, which is the *main app* set:
  `allow-jit`, `device.audio-input`, `device.bluetooth`, `device.camera`, `device.print`,
  `device.usb`, `personal-information.location`. The helper would be signed with six entitlements
  it has no use for. Against Apple's own instruction — "Make sure to use only the entitlements that
  are absolutely necessary for your app's functionality" — that alone justifies an
  `optionsForFile` override.
- **Ordering already works out.** `MacApp.create()` (`dist/mac.js:359`) runs
  `renameAppAndHelpers()` → `copyExtraResources()` → `signAppIfSpecified()` →
  `notarizeAppIfSpecified()` → `move()`. So `afterCopyExtraResources` is the **last hook before
  signing**, which is exactly where the helper must be moved. osx-sign then sorts its discovered
  children by path depth descending, so nested code is signed before the bundle — the inside-out
  order `codesign` requires.
- **Forge passes the hook through untouched.** `@electron-forge/core/dist/api/package.js:222-238`
  spreads `...forgeConfig.packagerConfig` and then overrides only `afterFinalizePackageTargets`,
  `afterComplete`, `afterCopy`, `afterExtract` and `afterPrune`. `afterCopyExtraResources` and
  `beforeCopyExtraResources` are not in that list, so a `packagerConfig.afterCopyExtraResources`
  reaches packager intact. Forge's own five hooks (`prePackage`, `packageAfterCopy`,
  `packageAfterPrune`, `packageAfterExtract`, `postPackage`) include no equivalent, so the
  packager-level hook is the only route.
- **`osxSign.binaries` is unavailable.** `dist/mac.js:393` warns
  `osx-sign.binaries is not an allowed sub-option. Not passing to @electron/osx-sign.` and deletes
  it. Do not plan around it.

### Gotcha: `afterCopyExtraResources` only fires if `extraResource` is set

`copyExtraResources()` returns early when `extraResource` is falsy — **before** running either
hook. So removing `extraResource` also removes the hook that would place the helper. Keep
`extraResource` and *move* the file within the hook.

### Concrete Forge configuration

Against the current `apps/desktop/forge.config.ts`. Not applied — another session owns that tree.

```ts
import { copyFile, mkdir, rename, stat } from 'node:fs/promises'

// Keep extraResource: it is what makes afterCopyExtraResources run at all.
// The hook then moves the helper from Resources (data) to Helpers (nested code).
packagerConfig: {
  asar: true,
  name: APP_NAME,
  appBundleId: 'tech.trili.argo.desktop',
  extraResource: HELPER_OUTPUT,
  ignore: (file) => (file ? !KEPT_IN_PACKAGE.some((kept) => kept.test(file)) : false),

  // (buildPath = stagingPath, electronVersion, platform, arch, callback)
  afterCopyExtraResources: [
    (buildPath: string, _v: string, platform: string, _a: string, done: () => void) => {
      if (platform !== 'darwin') return done()
      const contents = path.join(buildPath, `${APP_NAME}.app`, 'Contents')
      void (async () => {
        await mkdir(path.join(contents, 'Helpers'), { recursive: true })
        await rename(
          path.join(contents, 'Resources', HELPER_NAME),
          path.join(contents, 'Helpers', HELPER_NAME),
        )
        done()
      })()
    },
  ],

  ...distributionConfig,
}
```

and the signing options:

```ts
const distributionConfig =
  DISTRIBUTION_IDENTITY && NOTARY_PROFILE
    ? {
        osxSign: {
          identity: DISTRIBUTION_IDENTITY,
          continueOnError: false,
          // Narrow the helper to the one entitlement it needs. Everything
          // else keeps osx-sign's defaults by returning an empty object.
          optionsForFile: (filePath: string) =>
            path.basename(filePath) === HELPER_NAME
              ? {
                  entitlements: ['com.apple.security.cs.allow-jit'],
                  hardenedRuntime: true,
                }
              : {},
        },
        osxNotarize: { keychainProfile: NOTARY_PROFILE },
      }
    : {}
```

Three notes on that block, all read from source rather than docs:

- `entitlements` accepts **an array of entitlement keys**, not only a path — osx-sign writes the
  plist itself (`sign.js`, `mergeOptionsForFile`). No `.plist` file to keep in the repo.
- `optionsForFile` is **synchronous** and returns `PerFileSignOptions`; a partial object shallow
  merges over the defaults, so `{}` means "defaults".
- `preAutoEntitlements` is skipped for any path containing `.app/`, so it will not touch the helper.
  It applies only to the top-level bundle path.

`extendInfo` is irrelevant here — it edits the app's `Info.plist` and a bare Mach-O has none. It
would matter only for the `Contents/Frameworks/<name>.app` variant.

The existing `postPackage: signPackage` hook needs its path updated from
`Contents/Resources/HELPER_NAME` to `Contents/Helpers/HELPER_NAME`, and its dev-mode
`codesign --force --deep --sign -` will now sign the helper as genuine nested code.

## 2. Entitlements

**Recommendation: hardened runtime (`--options runtime`) plus exactly
`com.apple.security.cs.allow-jit`. Nothing else. Its own standalone entitlements, not inheritance.
Not sandboxed.**

### Measured

Same compiled Bun helper, truncated so it is signable, signed five ways, each run twice. The probe
runs a hot integer loop (200 × 1,000,000 `Math.imul` iterations) and prints the elapsed
milliseconds.

| Signature | `CodeDirectory` flags | hot loop, run 1 | run 2 |
|---|---|---|---|
| no hardened runtime, no entitlements | `0x0(none)` | 69.2 ms | 54.0 ms |
| **hardened runtime, no entitlements** | `0x10000(runtime)` | **4301.8 ms** | **4288.4 ms** |
| hardened runtime, `allow-jit` | `0x10000(runtime)` | 69.0 ms | 51.6 ms |
| hardened runtime, Bun's full five | `0x10000(runtime)` | 72.6 ms | 52.4 ms |
| reference: `BUN_JSC_useJIT=0`, hardened + `allow-jit` | — | 4274.0 ms | — |

Three conclusions:

- **`allow-jit` is required.** Without it, hardened runtime costs ~82x on JIT-bound work.
- **`allow-jit` is sufficient.** Adding `allow-unsigned-executable-memory`,
  `disable-executable-page-protection`, `allow-dyld-environment-variables` and
  `disable-library-validation` moves the number by less than run-to-run noise.
- **The failure mode is silent.** The process does not crash, does not warn, and exits 0. Nothing in
  a smoke test that only checks exit codes would catch a missing `allow-jit`. The 4290 ms figure
  matching the explicitly-JIT-disabled 4274 ms reference is what identifies the cause.

Apple documents exactly this fallback. The `allow-jit` page: "A Boolean value that indicates whether
the app may create writable and executable memory using the `MAP_JIT` flag. … The Hardened Runtime
disallows this by default … Without the Allow execution of JIT-compiled code entitlement, frameworks
that rely on just-in-time (JIT) compilation **may fall back to an interpreter**. Other code using
JIT compilation may crash or behave in unexpected ways." The hardened runtime page: "The Hardened
Runtime doesn't affect the operation of most apps, but it does disallow certain less common
capabilities, like just-in-time (JIT) compilation."

### The other four: not required, merely copied

Bun's own released binary carries all five. Measured on `/Users/miladalizadeh/.bun/bin/bun`
(1.3.13), `Developer ID Application: Jarred Sumner (7FRXF46ZSN)`, `flags=0x10000(runtime)`, with a
secure timestamp:

```
com.apple.security.cs.allow-dyld-environment-variables
com.apple.security.cs.allow-jit
com.apple.security.cs.allow-unsigned-executable-memory
com.apple.security.cs.disable-executable-page-protection
com.apple.security.cs.disable-library-validation
```

That is upstream's choice for a general-purpose runtime that must load arbitrary native addons and
honour `DYLD_*`. It is not the requirement for our helper, and the measurement above shows the extra
four buy nothing. What Apple says each is for:

- **`allow-unsigned-executable-memory`** — "whether the app may create writable and executable
  memory **without** the restrictions imposed by using the `MAP_JIT` flag", for cases like "override
  or patch C code", `NSCreateObjectFileImageFromMemory`, or the DVDPlayback framework. A `MAP_JIT`
  JIT does not need it. Apple: "Including this entitlement exposes your app to common
  vulnerabilities in memory-unsafe code languages. Carefully consider whether your app needs this
  exception."
- **`disable-executable-page-protection`** — for an app that "attempts to directly modify sections
  of its own executable files on disk". Apple calls it "an extreme entitlement that removes a
  fundamental security protection from your app, making it possible for an attacker to rewrite your
  app's executable code without detection. Prefer narrower entitlements if possible." The helper
  does not rewrite itself.
- **`allow-dyld-environment-variables`** — makes `dyld` honour `DYLD_*`. Argo has no reason to want
  the PTY helper's dynamic linker steerable by the environment; the opposite.
- **`disable-library-validation`** — for loading "plug-ins that are signed by other third-party
  developers". Measured: `otool -L` on a compiled Bun helper lists only
  `/usr/lib/libicucore.A.dylib`, `/usr/lib/libresolv.9.dylib`, `/usr/lib/libc++.1.dylib`,
  `/usr/lib/libSystem.B.dylib` — all Apple-signed, all fine under library validation. And Apple
  warns there is a cost: "Because library validation is such an important security-hardening
  feature, Gatekeeper runs extra security checks on programs that have it disabled."

The Electron precedent agrees. `Claude Helper (Renderer).app` — a V8 JIT process — carries exactly
one entitlement, `com.apple.security.cs.allow-jit`. So do osx-sign's own
`default.darwin.renderer.plist` and `default.darwin.gpu.plist`.

### Spawning a child process needs no entitlement

The helper spawns `claude`. Measured: under hardened runtime with an **empty** entitlements
dictionary, the compiled helper spawned all four of these and each exited 0 with the expected
output:

| child | result |
|---|---|
| Apple-signed binary (`/bin/echo`) | exit 0 |
| unsigned shell script | exit 0 |
| ad-hoc linker-signed Mach-O (`cc` output) | exit 0 |
| another `bun --compile` binary | exit 0 |

Adding `allow-jit` changed nothing. So: no entitlement gates `posix_spawn`, and library validation
does not reach across a process boundary — it constrains what a process loads into *itself*.

**On inherited entitlements.** Apple's hardened runtime page: "You add entitlements only to
executables. Shared libraries, frameworks, and in-process plug-ins inherit the entitlements of their
host executable." A separately-spawned child process is not in that list. It is its own executable
with its own signature and its own entitlements. Two consequences:

- The **helper needs its own entitlements file** (or, with osx-sign, its own `optionsForFile`
  entry). It does not inherit `allow-jit` from Argo's main executable, and the measurement above
  demonstrates that — the helper was signed and run standalone, and its behaviour tracked its own
  entitlements exactly.
- Conversely, `claude` — spawned by the helper — brings its own signature and entitlements. Argo
  grants it nothing and needs to declare nothing on its behalf. (The plug-in inheritance rule in
  Apple's notarization guide — "Plug-ins don't declare their own entitlements. Instead, they inherit
  the entitlements of the host process" — is about in-process plug-ins, not spawned children.)

### `com.apple.security.inherit`: no

It is an **App Sandbox** key, not a hardened-runtime one. Apple's entitlement reference lists it as
"Child process inheritance of the parent's sandbox", and the App Sandbox chapter says: "If your app
employs a child process created with either the `posix_spawn` function or the `NSTask` class, you can
configure the child process to inherit the sandbox of its parent. … To enable sandbox inheritance, a
child target must use exactly two App Sandbox entitlement keys: `com.apple.security.app-sandbox` and
`com.apple.security.inherit`. **If you specify any other App Sandbox entitlement, the system aborts
the child process.**"

Argo is Developer ID, not App Store, so it is not sandboxed, so there is no sandbox to inherit and
the key is inert. It is also mutually exclusive in spirit with what the helper needs: the "exactly
two keys" rule means a sandboxed-inheriting helper could not also carry an arbitrary entitlement
set. osx-sign encodes the same split — `default.mas.child.plist` is the *only* one of its six
entitlement files containing `inherit`, and it pairs it with `app-sandbox`; none of the three
`darwin` files mentions either.

**And the helper must not be sandboxed.** A PTY helper that opens a pseudo-terminal and executes an
arbitrary user-installed binary (`claude`) from an arbitrary working directory is close to the
opposite of a sandbox's purpose. Nothing about Developer ID distribution asks for one.

## 3. Notarization

**Recommendation: the helper is signed with the same Developer ID as the app, with
`--options runtime`, with `--timestamp`, with no `get-task-allow`. It receives no ticket of its own
and needs none; the app's stapled ticket covers it.**

### What the notary service requires of it

Apple's "Notarizing macOS software before distribution" lists the protections the service requires,
and the first one is what makes this a per-binary question, not a per-app one:

> Enable code-signing for **all of the executables you distribute**, and ensure that executables
> have valid code signatures … Use a "Developer ID" application, kernel extension, system extension,
> or installer certificate … (Don't use a Mac Distribution, **ad hoc**, Apple Developer, or local
> development certificate.) … Enable the Hardened Runtime capability for your app **and command line
> targets** … Include a secure timestamp with your code-signing signature. … Don't include the
> `com.apple.security.get-task-allow` entitlement with the value set to any variation of `true`. …
> Link against the macOS 10.9 or later SDK … Ensure your processes have properly-formatted XML,
> ASCII-encoded entitlements.

"all of the executables you distribute" and "command line targets" both cover a bare nested Mach-O.
Note "ad hoc" is explicitly excluded — which is what `bun build --compile` leaves behind
(`flags=0x20002(adhoc,linker-signed)`, `Signature=adhoc`, `TeamIdentifier=not set`, measured). An
un-re-signed Bun helper is a notarization failure on that ground alone.

### The specific rejection messages that apply

From "Resolving common notarization issues", verbatim, with the ones a nested unsigned or
non-hardened executable would actually hit:

| Condition | Message |
|---|---|
| modified after signing, or signature invalid | `The signature of the binary is invalid.` |
| ad-hoc / non-Developer-ID (i.e. as Bun emits it) | `The binary is not signed with a valid Developer ID certificate.` |
| signed without `--timestamp` | `The signature does not include a secure timestamp.` |
| hardened runtime not enabled | `The executable does not have the hardened runtime enabled.` |
| `get-task-allow` present | `The executable requests the com.apple.security.get-task-allow entitlement.` |
| binary-plist entitlements | `Embedded entitlements are invalid: syntax error near line 1` |
| pre-10.9 SDK | `The binary uses an SDK older than the 10.9 SDK.` |

The same page names the local pre-flight and, crucially, says why it is the right one:

> `% codesign -vvv --deep --strict /path/to/binary/or/bundle`
> … You use the `deep` option to ensure the utility checks nested code content. The `strict` option
> **increases the restrictiveness of the validation to match that required by notarization.**

That is the check the broken Bun output fails locally (`invalid signature (code or signature have
been modified)`), so the version trap in the section above would surface as a notarization rejection
if it were not caught first.

**It is caught first, by the existing pipeline.** `@electron/notarize` 2.5.0 `lib/index.js` runs
`checkSignatures()` **before** submitting, and `lib/check-signature.js` runs exactly
`codesign -vvv --deep --strict <app>` (plus `codesign -dv -vvvv --deep`), throwing on a non-zero
exit. So a helper that is unsigned, non-hardened, or byte-modified after signing fails the build
locally rather than after an upload round-trip. Worth knowing, and worth not weakening.

### Ticketing and stapling for a nested binary

**The nested helper gets no ticket. It is covered by the app's.** `man stapler` on this machine:

> A ticket contains a list of the code signatures for executables within a supported file format.
> The stapler utility downloads and attaches (staples) a ticket to these files, enabling Gatekeeper
> to verify that executables they contain have been properly notarized.
>
> **SUPPORTED FILE FORMATS** — stapler works only with UDIF disk images, signed "flat" installer
> packages, and certain code-signed executable bundles such as ".app". Passing an unsigned "flat"
> installer package or an unsigned executable bundle in path to stapler is considered an error.

A bare Mach-O is not a supported format, so there is nothing to staple to it. The app's ticket lists
the code signatures of the executables inside — including the helper's — which is exactly why the
helper's own signature has to be valid and Developer-ID-issued before submission.

Confirmed in the toolchain: `@electron/notarize/lib/notarytool.js:116-127` zips the bundle with
`ditto -c -k --sequesterRsrc --keepParent` and calls `notarytool submit` on the ZIP (consistent with
`man notarytool`: "notarytool submit works only with UDIF disk images, signed 'flat' installer
packages, and zip files"), then `lib/staple.js` runs `xcrun stapler staple -v <App>.app` — the
`.app`, never a nested path.

The stapled ticket is a real file, and I can see it: `/Applications/Claude.app/Contents/CodeResources`
is 2,682 bytes beginning with the magic `s8ch`, followed by a CMS blob whose certificate chain names
"Apple System Integration CA 4". VS Code has no such file; Claude, Cursor and LM Studio do.

One ordering constraint from the same man page, which matters if the repo ever adds a post-notarize
signing step:

> Stapling does not invalidate the code signature and must be run after an executable or archive has
> been code-signed and notarized with Developer ID. **Code-signing a supported file format
> invalidates any stapled tickets**, so `stapler staple` must be run again if this occurs.

So nothing may re-sign the `.app` after `osxNotarize` has run. In the current
`apps/desktop/forge.config.ts` the `postPackage: signPackage` hook only *verifies* when
`DISTRIBUTION_IDENTITY` is set (`stapler validate`, `spctl --assess`) and only re-signs in the
unsigned dev path — which is correct, and is a property to preserve deliberately rather than by
luck.

## 4. Update integrity

**Recommendation: no change is needed for update safety, and the TN2206 warning does not apply to
Argo. Move the helper for the other three reasons, not this one.**

### The two sealing cases, measured

The fixture again, with a genuinely different second helper (a different compiled script, so
different bytes and a different `cdhash`), replacing one copy at a time and re-running
`codesign --verify --deep --strict Fixture.app`:

| Case | What was replaced | Replacement signed by | Verdict |
|---|---|---|---|
| A | `Contents/Resources/argo-pty-helper` (sealed as data, `hash2`) | same identity, valid | **FAIL** — `a sealed resource is missing or invalid` |
| B | `Contents/Helpers/argo-pty-helper` (sealed as nested code) | same identity + same `-i` identifier | **PASS** |
| C | `Contents/Helpers/argo-pty-helper` (sealed as nested code) | ad-hoc (`-s -`) | **FAIL** — `nested code is modified or invalid` |
| D | control, nothing replaced | — | **PASS** |

That is TN2206's mechanism, reproduced exactly:

> Nested code can be replaced with equivalent (conforms to the designated requirement) nested code
> without disturbing the outer signature. This is the design mechanism for indirection in code
> bundles.

Case B is "equivalent". Case C is not — the recorded requirement pins the leaf certificate and the
signing identifier, so an ad-hoc replacement fails it. Case A shows the data seal is a plain content
hash with no notion of equivalence: any change at all breaks it.

### Whether it applies to Argo: it does not

TN2206's warning is scoped, in its own words, to "apps that **use their own update mechanisms to
replace nested code**". Argo does not replace nested code. It replaces the bundle.

Electron's `autoUpdater` on macOS is Squirrel.Mac — `docs/api/auto-updater.md`: "On macOS, the
`autoUpdater` module is built upon Squirrel.Mac" — and Forge is configured with `MakerZIP` +
`MakerDMG`, with updates shipping as whole-app ZIPs (`docs/tutorial/updates.md` shows
`my-app-1.1.0-darwin-arm64.zip`).

Squirrel.Mac's installer swaps the whole `Contents` directory in one atomic operation.
`Squirrel/SQRLInstaller.m`:

```objc
// rename() is atomic, NSFileManager sucks.
if (rename(sourceContentsURL.path.fileSystemRepresentation,
           targetContentsURL.path.fileSystemRepresentation) == 0) {
```

where `targetContentsURL` is `[targetURL URLByAppendingPathComponent:@"Contents"]`. The new
`Contents` arrives complete — its `_CodeSignature/CodeResources`, its `Resources`, its `Helpers`,
all of it — and the old one goes away in the same `rename`. The outer signature and the content it
seals are never out of step, because they are never separated. (There is a cross-volume fallback
that does `removeItemAtURL:` then `moveItemAtURL:`, still whole-directory.)

Squirrel also gates the swap on the signature. `SQRLInstaller.m`'s
`prepareAndValidateUpdateBundleURLForRequest:` is documented as: "Moves the updateBundleURL to an
owned directory to prevent symlink attack, takes user:group ownership of the bundle, then verifies
that it meets the **designated requirement of the targetBundleURL**." Electron's docs restate the
consequence: "Your application must be signed for automatic updates on macOS. This is a requirement
of `Squirrel.Mac`."

So Argo's real update integrity property is: *the incoming bundle must satisfy the installed
bundle's designated requirement*. That is an app-level check, and it is unaffected by whether the
helper inside is sealed as code or as data.

Electron's docs also describe a delta path — an update entry may carry a `delta` object, and "that
patch is downloaded instead of the ZIP, applied to a copy of the running app, and the result goes
through the same code signing verification as an unpacked ZIP; on any failure the ZIP is downloaded
in the same check". Still a whole-bundle result, still fully verified, with a fallback. It does not
reintroduce the nested-replacement pattern.

### When it *would* apply

Three futures make the warning live, and all three are the same shape — something updates a file
inside the installed bundle without re-signing the bundle:

1. **A helper-only side-channel update.** If Argo ever ships a new PTY helper on its own — to track
   a `claude` CLI change, or to avoid a 60 MB full-app download for a small helper fix — then with
   the helper in `Resources` the app's signature breaks on the spot (case A), and with it in
   `Helpers` a same-identity replacement is legal (case B). Given the helper is ~62 MB of a bundle
   whose whole point is a 60 MB Bun runtime, this is a plausible future, not a hypothetical.
2. **Writing anything into the bundle at runtime.** Caches, logs, a downloaded `claude`, a scratch
   file next to the helper. Apple's guidance is unambiguous — TN2206: "Bundles should be treated as
   read-only once they have been signed" — and the
   `disable-executable-page-protection` page adds the update rule: "Ensure that you perform updates
   atomically, with the final app bundle swapped out after app exit", which is precisely what
   Squirrel does and what a runtime write does not.
3. **Swapping the updater.** An `electron-updater`-style or hand-rolled updater that patches files
   in place rather than replacing `Contents` would put Argo squarely inside the warning.

For case 1 the position choice is the whole difference between "supported mechanism" and "broken
signature", which is a good reason to take the `Helpers` position now, while it costs one hook,
rather than after a helper-only update is wanted.

## What I could not verify

- **That Bun ≥ 1.4.2 is fixed *because of* PR #29272.** I measured that the repo's 1.4.2-built
  artifact has zero trailing bytes and signs cleanly, and that 1.3.13 does not. I did not build the
  same input with 1.4.2 myself — only 1.3.13 is installed here — so the 1.4.2 row of my table is the
  repo's existing `apps/desktop/build/argo-pty-helper`, a different input script. The property I
  care about (trailing bytes, signability) is input-independent, but I am not claiming a controlled
  same-input comparison across versions.
- **Which Bun release first contains the fix.** PR #29272 merged 2026-04-14 and bun-v1.3.13 shipped
  2026-04-20, yet 1.3.13 reproduces the bug. I could not resolve that contradiction. Do not read
  "≥ 1.3.13" as safe; assert the property at build time.
- **The mechanism narrative in Bun #29276.** The root-cause comment (`MachoSigner` truncation, an
  under-sizing in `src/macho.zig`'s `writeSection`) is from `robobun`, a bot, and the issue was
  auto-closed as a duplicate. It is consistent with my measurements and with the merged PR's title,
  but I did not read `src/macho.zig`. The *observable* facts — offsets, sizes, trailing bytes,
  `codesign` refusals — are mine.
- **The contents of a stapled ticket.** `man stapler` states a ticket "contains a list of the code
  signatures for executables". I tried to decode `/Applications/Claude.app/Contents/CodeResources`
  to confirm the nested helpers' cdhashes appear in it and failed — `openssl cms` rejected the blob
  at the offsets the `s8ch` header implies, and I did not reverse the container further. So the
  claim "the app's ticket covers the nested binary" rests on the man page, not on my own decode.
- **A real Developer ID end-to-end run.** This machine has only
  `Apple Development: Milad Alizadeh (3DP93359T5)`. Everything about hardened runtime, entitlement
  effects, nested-vs-data sealing and replacement equivalence is identity-independent and was
  measured. But I did not submit anything to the notary service, so no notarization result here is
  first-hand: the rejection messages and requirements are quoted from Apple's docs, and the
  designated-requirement string I show has an Apple Development shape, not a Developer ID one.
- **Whether `claude` needs anything from Argo.** I measured that spawning unsigned and ad-hoc
  children works under hardened runtime with no entitlements, using synthetic children. I did not
  test spawning the real `claude` CLI from a signed, hardened helper inside a packaged bundle.
- **`spctl` on the fixture.** It reports `rejected` for my fixture, as expected for an app signed
  with a development certificate and never notarized. That says nothing about the real pipeline, and
  I did not get a positive `spctl` assessment for any configuration.
- **The `Contents/Frameworks/<name>.app` variant.** I reasoned about it from the sealing rules and
  from Claude.app's `Helpers/Claude iOS Sim.app` precedent, but I did not build a bundled helper app
  fixture and confirm what Forge does with one.

## Newly visible decisions and fog

- **What asserts that the compiled helper is signable, and where does it run?** A Bun bump or
  downgrade can silently produce an unsignable helper. The property is cheap to check
  (`codesign -v`, plus zero bytes after `LC_CODE_SIGNATURE`) and there is currently nothing that
  checks it. Does it belong in the `prePackage` hook that already version-checks Bun, in a test, or
  in the quality gates?
- **Is `bun@1.4.2` pinned for signability, and does anything record that?** The pin currently reads
  as a reproducibility choice. If it is also a correctness boundary, the next person to bump it
  needs to know.
- **Will the helper ever be updated on its own?** This is the question that decides whether the
  `Helpers` position is a correctness tidy-up or a prerequisite. A ~62 MB helper inside a bundle
  updated by whole-app ZIP is a real download-size argument for a helper-only channel, and that
  channel is only legal from the nested-code position.
- **What proves `allow-jit` is still in effect after a signing change?** The failure mode is an 82x
  slowdown with exit code 0. No current test would see it. A timing assertion is fragile in CI, but
  `codesign -d --entitlements -` on the packaged helper asserting exactly one key is not — is that
  worth a test?
- **Does anything stop a sidecar file landing in `Contents/Helpers`?** A data file there fails the
  *outer* signing with an error that names the file and not the rule. One sentence in the config, or
  a check, would save a confusing hour later.
- **Which entitlements does the Argo main app itself need, and has anyone chosen them?**
  `osxSign` currently passes no `optionsForFile`, so the main app and its four Electron helpers get
  osx-sign's defaults, including `default.darwin.plist` with camera, bluetooth, USB, print,
  microphone and location. Against Apple's "use only the entitlements that are absolutely
  necessary", that is worth an explicit decision rather than a default. Separate from #1759, but
  visible from it.
- **What guarantees nothing re-signs the `.app` after notarization?** `stapler` invalidates a
  stapled ticket if the bundle is re-signed. The current `postPackage` hook happens to only verify
  in the signed path. Is that intended and pinned, or incidental?
- **Does the helper's signing identifier need to be stable across releases?** The nested-code
  requirement pins `identifier`. `codesign` defaults it from the filename (`argo-pty-helper`), which
  is stable today, but nothing states it as a contract. If a helper-only update channel ever
  appears, that identifier becomes part of it.

## Primary sources

### Apple documentation

- TN2206, "macOS Code Signing In Depth" — <https://developer.apple.com/library/archive/technotes/tn2206/_index.html>
  (fetched, then re-verified verbatim from raw HTML: HTTP 200, 107,662 bytes)
- Hardened Runtime — <https://developer.apple.com/documentation/security/hardened-runtime>
  (via `https://developer.apple.com/tutorials/data/documentation/security/hardened-runtime.json`)
- Allow execution of JIT-compiled code — <https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.cs.allow-jit>
- Allow Unsigned Executable Memory — <https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.cs.allow-unsigned-executable-memory>
- Disable Executable Memory Protection — <https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.cs.disable-executable-page-protection>
- Allow DYLD environment variables — <https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.cs.allow-dyld-environment-variables>
- Disable Library Validation — <https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.cs.disable-library-validation>
- Notarizing macOS software before distribution — <https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution>
- Resolving common notarization issues — <https://developer.apple.com/documentation/security/resolving-common-notarization-issues>
- Enabling App Sandbox / Enabling App Sandbox Inheritance — <https://developer.apple.com/library/archive/documentation/Miscellaneous/Reference/EntitlementKeyReference/Chapters/EnablingAppSandbox.html>
  (verified verbatim from raw HTML: HTTP 200, 59,623 bytes)

All `developer.apple.com/documentation` pages were read through the
`developer.apple.com/tutorials/data/documentation/<path>.json` API and rendered with a local
extractor, so no summarising model stood between the page and the quotes above.

### Man pages (local, macOS 26.5.2 build 25F84)

- `man codesign` — the `--deep` nested-code directory list, `--strict` options, `-f`, `--timestamp`
- `man notarytool` — `SUPPORTED UPLOAD FILE FORMATS`, `BACKGROUND`
- `man stapler` — `DESCRIPTION` (what a ticket contains), `SUPPORTED FILE FORMATS`

### Electron, Forge, Squirrel (source)

- `@electron/osx-sign` 1.3.3 — `dist/esm/sign.js`, `dist/esm/util.js`, `dist/esm/types.d.ts`,
  `entitlements/default.darwin*.plist`, `entitlements/default.mas.child.plist`, at
  `/Users/miladalizadeh/Developer/argo/node_modules/@electron/osx-sign/`
- `@electron/packager` 18.4.4 — `dist/platform.js` (`copyExtraResources`, `commonHookArgs`),
  `dist/mac.js` (`resourcesDir`, `create()`, `createSignOpts`), `dist/hooks.js`, `dist/types.d.ts`, at
  `/Users/miladalizadeh/Developer/argo/.claude/worktrees/ticket-1743-prove-packaged-electron/node_modules/@electron/packager/`
- `@electron/notarize` 2.5.0 — `lib/index.js`, `lib/check-signature.js`, `lib/staple.js`,
  `lib/notarytool.js`
- `@electron-forge/core` — `dist/api/package.js` lines 156-260 (hook wiring)
- `@electron-forge/shared-types` — `dist/index.d.ts` (Forge's five hook names)
- Electron docs — `docs/api/auto-updater.md`, `docs/tutorial/updates.md`,
  `docs/tutorial/code-signing.md`, from `raw.githubusercontent.com/electron/electron/main/`
- Squirrel.Mac — `Squirrel/SQRLInstaller.m` and `README.md`, from
  `raw.githubusercontent.com/Squirrel/Squirrel.Mac/master/`

### Bun

- `bun build --help` (1.3.13) — no macOS signing or entitlement flags exist
- Issue [oven-sh/bun#29120](https://github.com/oven-sh/bun/issues/29120), PR
  [#29272](https://github.com/oven-sh/bun/pull/29272), issue
  [#29276](https://github.com/oven-sh/bun/issues/29276), and
  [#15525](https://github.com/oven-sh/bun/issues/15525) /
  [#17207](https://github.com/oven-sh/bun/pull/17207) (the original "Support codesigning macOS
  executables in `bun build --compile`", merged 2025-02), all read through the GitHub API
- `GET /repos/oven-sh/bun/releases` — bun-v1.3.12 2026-04-10, bun-v1.3.13 2026-04-20,
  bun-v1.3.14 2026-05-13

### Shipped apps inspected (read-only)

`/Applications/{Visual Studio Code,Cursor,LM Studio,Claude,Slack,Notion,Docker}.app` — outer
`Contents/_CodeSignature/CodeResources` parsed with `plistlib`; `Claude.app/Contents/Helpers/*`
inspected with `codesign -dvvv --entitlements -`; `Claude.app/Contents/CodeResources` identified as
a stapled `s8ch` ticket. `/Users/miladalizadeh/.bun/bin/bun` inspected for its shipped entitlements.

### Repo files read (not modified)

- `apps/desktop/forge.config.ts` and `apps/desktop/src/pty-contract.json` in the
  `ticket-1743-prove-packaged-electron` worktree
- `apps/desktop/build/argo-pty-helper` — the real pinned-Bun artifact, copied out and inspected
- root `package.json` — `"packageManager": "bun@1.4.2"`

### Measurement scripts

Written and run in the scratchpad at
`…/0a7156c1-f805-4108-9e87-c27c4f2bb883/scratchpad/bunsign/`: `matrix.sh` (entitlement matrix),
`diag.sh` (Mach-O layout, controls), `fix.sh` and `strip.sh` (truncate-then-sign),
`jit.sh` + `jit.ts` (JIT timing matrix), `spawn.sh` + `spawn.ts` (child-spawn matrix),
`fixture.sh` (the two-position `.app` fixture), `replace.sh` (the seal-replacement matrix),
`helpersdir.sh` (the only-code constraint), `version.sh` and `envvar.sh` (Bun version isolation and
the `BUN_NO_CODESIGN_MACHO_BINARY` workaround), `apple.sh` + `extract.py` (Apple docs retrieval).
