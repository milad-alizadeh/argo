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
  ArgoDesign/       the token contract and the primitives over it. A leaf: SwiftUI and
                    AppKit, nothing of Argo's (#1088)
    ArgoDesign/     palette, type, spacing, radii, elevation, motion (#375) — TOKENS only
    ArgoAtoms/      the shared views and materials built out of those values (#772), and
                    whether a focus ring would be answering the keyboard (#533)
  ArgoUI/           shared visual components. No engine dependency
    Shell/          production NavigationSplitView, sidebar, deck ground and toolbar vessels
                    — and each surface's own measure sheet, beside the surface it measures (#756)
  ArgoUI/ArgoFixtures/   sample transcripts and Tickets. Depends on ArgoEngine and nothing else
  ArgoUI/ArgoSpecimens/  the specimen harness and every #Preview drawn from a fixture (#1085)
```

`ArgoFixtures` and `ArgoSpecimens` are targets in the ArgoUI **package**, beside `ArgoUI` rather
than inside it: 7,300 lines of dev-tool code used to compile into the library that draws the
product, and no gate could see the edge while they did. `swift-boundaries.sh` edge 8 keeps the
arrow pointed one way. The app target links `ArgoSpecimens` because the harness is reached by
launch argument on the real binary — that is what makes a specimen render evidence.

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

That incremental state can go stale in one way worth knowing, because it does not look like a
build failure: after a file was ADDED to `Packages/ArgoUI`, an incremental build succeeded and
the app then died at launch inside `initializeWithCopy` — the app and the package dylib
disagreeing about a struct's layout. `rm -rf build/Build` and a full build was the whole fix.

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
`macos-26` runner on Xcode 26.6, with SwiftLint and SwiftFormat downloaded at pinned versions
and asserted rather than taken from whatever the image ships, and the whole job skipped when a
PR touches no Swift. The default jobs are still Linux, where there is no Swift toolchain and no
`xcodebuild`; `bun run test` at the repo root calls the suites there too and skips with a
printed reason, so a missing toolchain never reads as a passing suite.

That skip is exactly what would make the macOS job green over nothing, so the job sets
`ARGO_REQUIRE_SWIFT_TOOLS=1`, which turns every skip in `swift-test.sh`, `swift-lint.sh` and
`swift-format.sh` into a failure — one definition, in `scripts/swift-tool-guard.sh`, that all
three source. `scripts/swift-tooling.test.mjs` holds it.

## Gates

The same bargain the TypeScript side has, in Swift's spelling. Everything below runs
pre-commit on staged `.swift` files; `bun run quality` runs the lot over the whole tree, and
so does CI, with SwiftFormat in `--check` mode rather than rewriting.

| Gate | What holds it | Config |
|---|---|---|
| Formatting | SwiftFormat | `.swiftformat` |
| The caps and the escape-hatch bans | SwiftLint, every rule an error | `.swiftlint.yml` (+ a nested one under `Packages/ArgoEngine/Tests`) |
| Package layering | `scripts/swift-boundaries.sh` | the edges below |
| Design tokens | the same script, edge 7 | `scripts/check-design-tokens-swift.sh` and its allowlist |
| Duplication | `jscpd`, Swift included | `.jscpd.json` |

The numbers are `biome.jsonc`'s numbers: a 200-line function is as unreadable in Swift as in
TypeScript. `rules/swift-style.md` is the prose half — how Swift spells `rules/code-style.md`,
plus the SwiftUI section that extends `rules/ui-components.md`.

Boundaries are checkable by imports and declarations alone, which is why they are gates rather
than review notes: **ArgoEngine** never imports a UI framework, **ArgoDesign** imports nothing of
Argo's at all, and the **app target** declares no `View` — everything with logic in it belongs in
a package, where a test can reach it.

Colours, type, spacing, radii, strokes, elevation and motion come from `ArgoDesign` (#375), and
the guard's only job is to keep every other file naming a role instead of writing a value down.
`ArgoDesign` is exempt because it IS the contract, and that exemption is a MODULE rather than a
folder name as of #1088 — which is the whole reason the check can run on CI. What a specimen
carries is debt on the allowlist, named and shrink-only, not a directory waved through.

The contract holds **tokens and nothing else**, which took three cuts to get to. #772 took out the
views: `ArgoBadge`, `ArgoGlyph`, `ArgoFloatingGlass` and the rest are `ArgoAtoms`, inside the
guard's scope like every other view. #756 took out the **measures** — how wide the reading runs,
how tall a chip stands — because that is a property of the content, so each sheet lives in the
directory of the one surface whose layout it describes: `ArgoFeedRow`, `ArgoComposerVessel`,
`ArgoMinimapLane` and `ArgoPlanPill`, under `Shell/Deck/{Feed,Composer,Minimap,Plan}/`. #773
finished the job inside `ArgoLayout` itself: nineteen of its forty members were read from exactly
one surface directory, and they left as `ArgoToolbarVessel`, `ArgoContextBar`, `ArgoConnectPanel`,
`ArgoAgentsRail` and `ArgoRosterFoot`.

What is left of `ArgoLayout` is the exception that is not one: the splits between panes describe
the window, which is every surface and so no single one. `rules/design-system.md` lists all three
populations by file.

## Screenshots

```bash
bun run screenshot --filter=@argo/macos -- out/cockpit.png
```

Builds, launches, and captures the window. See AGENTS.md ("Visual verification") for what it
does about an already-running instance, and why that matters.

## End-to-end tests

`ArgoE2ETests` is the one target that launches Argo and clicks it:

```bash
sh scripts/e2e-test.sh                # this machine's screen — takes your mouse for the run
```

XCUITest drives the real WindowServer; that is what lets it click, and it is why the run holds the
keyboard and mouse hostage until it finishes. There is no headless mode to switch on, so the run
needs a machine nobody is using. The first run on a machine also answers macOS's UI-testing
authorisation prompt by hand, and a sleeping display fails the same way.

Not a CI gate. Driving the real app needs a macOS runner, the most expensive minutes GitHub bills,
and the suite is a handful of clicks; run it locally when you touch a surface that is only reachable
by clicking.

## Measuring frames

**The probe** (`ArgoUI/Perf/`) samples the cockpit window's real presentation cadence through a
`CADisplayLink`, and is inert unless `ARGO_FRAME_PROBE=1`. It writes a JSON summary — the display's
own maximum fps, effective fps, interval percentiles, the frames that ran over 1x/2x/4x of the
budget, and a stamp per frame — to `ARGO_FRAME_PROBE_OUT`, on SIGINT, on app exit, or after
`ARGO_FRAME_PROBE_SECONDS`. The ceiling is READ, never assumed: this machine's Studio Display is
60 Hz, and the same figures have to stay comparable on a 120 Hz panel.

```bash
ARGO_FRAME_PROBE=1 ARGO_FRAME_PROBE_OUT=/tmp/frames.json open -a Argo
```

It measures whoever is scrolling, which is a person. **There is no driver**: a harness that posted
synthetic scrolls and clicks was built and then removed, because taking the pointer and keyboard out
from under whoever is at the machine is not a thing this repo does. The scroll figures in #963 came
from that harness before it went, and are the last of their kind — a future comparison is measured
by scrolling the feed by hand with the probe on.

Two figures answer different questions, and the probe gives only the first. **Cadence** is when the
frame intervals return to idle: whether the main thread stalled. **Surface** is when the reading has
actually arrived. A switch that takes twenty seconds to put content up drops almost no frames while
it does, so cadence alone would call it instant. Nothing on CI renders a view, so the surface half
is a human looking at the screen (see `docs/agents/visual-verification.md`).

## The largest Session, synthesised

Every gate over a settled document is measured against one Session — 4 800 records, 63 MB, the one
whose geometry ADR-0030 is about. That transcript is somebody's own words and this repository is
public, so what is checked in is a SYNTHETIC of it, in
`Packages/ArgoUI/Sources/ArgoFixtures/Fixtures/`, read through the same reader a real transcript
is.

What it holds is the shape: the same records, the same row kinds, the same tool calls, the same
joins between a call and its result, and the same line count in every string. What it does not
hold is anybody's words — every string, **keys included**, is replaced by lorem of the same
length. Two deliberate exceptions, both named in `SyntheticTranscript` and re-stated by a test:
the fields a reading BRANCHES on (`type`, `role`, a tool's `name`, `timestamp`, `model`,
`gitBranch`, …), which decide a row's kind, and a picture's bytes, which become a one-pixel PNG —
so the fixture stands for a Session's geometry and not for what its screenshots cost.

```bash
cp <a real transcript>.jsonl apps/macOS/Fixtures/settled-session.jsonl   # gitignored
sh apps/macOS/scripts/synthesise-fixture.sh
```

The generator writes nothing when the two documents stop reading alike: it projects both and
prints every counted fact that moved. `SettledSessionFixtureTests` holds the synthetic to the
shape file beside it on every run, and `SettledSessionFigureRecording` makes the comparison
against the real file on a machine that has one — and records a **named skip** where there is
none, because a gate that exits green having looked at nothing is the failure this fixture exists
to prevent.

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
