# Argo — macOS

The native Swift cockpit ([ADR-0022](../../docs/adr/0022-swift-native-macos-runtime.md), [#373](https://github.com/milad-alizadeh/argo/issues/373)). Replaces `apps/desktop`, which is frozen and deleted at the end of the migration.

## Layout

```
Argo.xcodeproj      the app target: bundle identity, signing, Info.plist keys
Argo/               app-target sources — the @main App and its scene
Argo.entitlements   signing entitlements (sandbox off, see below)
Packages/
  ArgoEngine/       domain + engine. No UI, no AppKit — runs under `swift test`
  ArgoUI/           shared visual components. No engine dependency
    VisualContract/ the palette, type, geometry, elevation and motion roles (#375)
    Specimen/       throwaway views that show the contract on real surfaces
```

`Argo/` is a **file-system-synchronized group**: the project file does not enumerate its
contents, so adding a Swift file to that folder adds it to the target with no `.pbxproj`
edit and no merge conflict. Only the app target lives in Xcode — everything with logic in
it belongs in a package, where it is testable from the command line.

## Build and run

```bash
bun run build --filter=@argo/macos   # xcodebuild, Debug, into ./build
open build/Build/Products/Debug/Argo.app
```

Or open `Argo.xcodeproj` and press ⌘R. The `Argo` scheme is shared and committed —
`xcodebuild -scheme Argo` depends on it.

Turbo does not cache the build: `xcodebuild` keeps its own incremental state in
`build/` (DerivedData), and handing hundreds of megabytes to a second cache buys nothing.

Neither package has a test target yet — there is no behaviour here to make a claim about.
The first one arrives with the engine in Phase 1, along with the task that runs them.
They will not run in CI: CI is Linux, where there is no Swift toolchain and no
`xcodebuild`.

## Deployment target

macOS 26.0, no fallback. There is no `#available` branching anywhere — Liquid Glass comes
from the system or the app does not run. `LSMinimumSystemVersion` is not written by hand;
`GENERATE_INFOPLIST_FILE` derives it from `MACOSX_DEPLOYMENT_TARGET`, so the two can never
disagree.

## Signing

Ad-hoc ("Sign to Run Locally"), no development team, hardened runtime off. Enough to
launch and debug locally; real signing and notarization are Phase 7.

The App Sandbox is **off by design**, declared once in `Argo.entitlements`. Argo reads CLI
transcripts from arbitrary paths, shells out to `git`/`gh`, and owns PTYs — the sandbox
forbids all three.
