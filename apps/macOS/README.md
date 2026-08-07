# Argo — macOS

The native Swift cockpit ([ADR-0022](../../docs/adr/0022-swift-native-macos-runtime.md), [#373](https://github.com/milad-alizadeh/argo/issues/373)). Replaces `apps/desktop`, which is frozen and deleted at the end of the migration.

## Layout

```
Argo.xcodeproj      the app target: bundle identity, signing, Info.plist keys
Argo/               app-target sources — the @main App and its scene
Argo.entitlements   signing entitlements (sandbox off, see below)
Packages/
  ArgoEngine/       domain + engine. No UI, no AppKit — runs under `swift test`
    Hub/            the process-lifetime in-memory join consumed by the app
    Launch/         launch arguments resolved into external source locations
    Repository/     the global primary-checkout projection
    Session/        the domain: the event model, evidence, tiers, usage
    Transcript/     the untrusted-input boundary: one .jsonl becomes typed events
    argo-observe/   the CLI that tails a transcript and prints what it reads
  ArgoUI/           shared visual components. No engine dependency
    Shell/          production NavigationSplitView, sidebar, deck ground and toolbar vessels
    VisualContract/ the palette, type, geometry, elevation and motion roles (#375)
    Specimen/       preview-only views that show the contract's roles together
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

The shell accepts repeatable `--transcript <file.jsonl>` arguments and an optional
`--project <directory>`. With no transcript it renders the production zero-Session state; a
configured transcript is consumed through the same typed stream as `argo-observe`.

Turbo does not cache the build: `xcodebuild` keeps its own incremental state in
`build/` (DerivedData), and handing hundreds of megabytes to a second cache buys nothing.

## The engine, without a window

`ArgoEngine` builds and tests on its own, with no Xcode and no app:

```bash
cd Packages/ArgoEngine
swift test
swift run argo-observe ~/.claude/projects/<project>/<session>.jsonl        # follows
swift run argo-observe <transcript.jsonl> --once                          # reads and exits
```

`argo-observe` prints one line per event as the file grows. It is a debugging surface, not a
rendering: it names the honesty tier on every fact that carries one and clamps prose to a
terminal width, so the SHAPE of a session is readable in a scroll.

The tests run against the Electron reader's own fixtures, copied unchanged into
`Tests/ArgoEngineTests/Fixtures/`. Both readers answer the same bytes; editing a fixture to
suit Swift would retire the only evidence that they agree.

Both suites run in CI on the `macos build · swift tests · lint` job (#415) — a pinned
`macos-26` runner on the image's Xcode 26.6, skipped when a PR touches no Swift. The default
jobs are still Linux, where there is no Swift toolchain and no `xcodebuild`; `bun run test` at
the repo root calls the suites there too and skips with a printed reason, so a missing
toolchain never reads as a passing suite.

That skip is exactly what would make the macOS job green over nothing, so the job sets
`ARGO_REQUIRE_SWIFT_TOOLS=1`, which turns every skip in `swift-test.sh`, `swift-lint.sh` and
`swift-format.sh` into a failure. `scripts/swift-tooling.test.mjs` holds that.

## Gates

The same bargain the TypeScript side has, in Swift's spelling. Everything below runs
pre-commit on staged `.swift` files; `bun run quality` runs the lot over the whole tree, and
so does CI, with SwiftFormat in `--check` mode rather than rewriting.

| Gate | What holds it | Config |
|---|---|---|
| Formatting | SwiftFormat | `.swiftformat` |
| The caps and the escape-hatch bans | SwiftLint, every rule an error | `.swiftlint.yml` (+ a nested one under `Packages/ArgoEngine/Tests`) |
| Package layering | `scripts/swift-boundaries.sh` | the three edges below |
| Design tokens | `scripts/check-design-tokens-swift.sh` | `Packages/ArgoUI/Sources/ArgoUI/VisualContract/` |
| Duplication | `jscpd`, Swift included | `.jscpd.json` |

The numbers are `biome.jsonc`'s numbers: a 200-line function is as unreadable in Swift as in
TypeScript. `rules/swift-style.md` is the prose half — how Swift spells `rules/code-style.md`,
plus the SwiftUI section that extends `rules/ui-components.md`.

Boundaries are checkable by imports and declarations alone, which is why they are gates rather
than review notes: **ArgoUI** never imports ArgoEngine, **ArgoEngine** never imports a UI
framework, and the **app target** declares no `View` — everything with logic in it belongs in a
package, where a test can reach it.

Colours, type, geometry, elevation and motion come from `ArgoUI/VisualContract/` (#375), and the
guard's only job is to keep every other file naming a role instead of writing a value down.
`VisualContract/` is exempt because it IS the contract; `Specimen/` is exempt for the opposite
reason — a specimen exists to show what a role is worth, and it ships in no screen.

## Screenshots

```bash
bun run screenshot --filter=@argo/macos -- out/cockpit.png
```

Builds, launches, and captures the window. See AGENTS.md ("Visual verification") for what it
does about an already-running instance, and why that matters.

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
