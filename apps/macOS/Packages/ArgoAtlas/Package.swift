// swift-tools-version: 6.2
import PackageDescription

/// The Atlas: a repository read as a city, tiled, banded and drawn (#1140).
///
/// A package of its own for the reason ADR-0022 splits the engine off and #1087 split the mermaid
/// renderer off after it: the layout half is not a view. It tiles a tree, bands a measure and picks
/// a plot under a cursor, and none of that needs a window.
///
/// Two targets draw the split, mirroring `ArgoMermaid`: `AtlasLayout` answers geometry and imports
/// no UI framework, so it runs under `swift test`; `AtlasView` draws what it decided. Edge 2 of
/// `scripts/swift-boundaries.sh` holds the first half. `AtlasFixtures` is a third and is data
/// only — the one committed measurement, read by the suite and by the specimen harness alike.
///
/// `ArgoDesign` hangs off the drawing half alone, because the layout half decides sizes and the
/// contract it will one day read — the measure ramp of #1142 — is spent on a pixel, not on a plot.
/// The public surface stays small on purpose: everything the two targets share and nothing outside
/// needs is `package`.
let package = Package(
    name: "ArgoAtlas",
    platforms: [.macOS("26.0")],
    products: [
        .library(name: "AtlasLayout", targets: ["AtlasLayout"]),
        .library(name: "AtlasView", targets: ["AtlasView"]),
        // The committed measurement, so the specimen harness draws the map the suite asserts on
        // rather than a second copy of it (#1147).
        .library(name: "AtlasFixtures", targets: ["AtlasFixtures"]),
    ],
    dependencies: [
        .package(path: "../ArgoDesign"),
    ],
    targets: [
        .target(name: "AtlasLayout"),
        // A real measurement of this repository, trimmed. Its own README states what was measured
        // and which awkward cases it was chosen to carry (#1145). A target rather than a resource
        // of the suite that first needed it, because the specimen harness draws the same map
        // (#1147) and two copies of 47 KB of measured JSON are two fixtures that can disagree.
        .target(name: "AtlasFixtures", dependencies: ["AtlasLayout"], resources: [
            .copy("Fixtures"),
        ]),
        .target(
            name: "AtlasView",
            dependencies: [
                "AtlasLayout",
                .product(name: "ArgoDesign", package: "ArgoDesign"),
            ],
            // `AtlasVolume.metal` is declared because the two build systems that read this manifest
            // disagree about it, and only one of them says so (#1144). Xcode compiles it — that is
            // what `CompileMetalFile` in an `xcodebuild` log is — while SwiftPM's own build does
            // not know the extension at all and drops it with an "unhandled file" warning.
            // Declaring it settles both: Xcode still compiles it into the target's
            // `default.metallib`, and `swift build` stops warning and starts generating
            // `Bundle.module`, which is what `AtlasVolumeRenderer` loads the library from. A
            // `swift test` binary therefore carries the source and no metallib, and the renderer
            // answers that the way it answers a machine with no GPU: it returns nil and the map
            // shows its floor.
            resources: [.process("AtlasVolume.metal")],
        ),
        .testTarget(
            name: "AtlasLayoutTests",
            dependencies: ["AtlasLayout", "AtlasFixtures"],
        ),
        // Everything about the drawing half that fails SILENTLY: the face struct declared twice,
        // once here and once in `AtlasVolume.metal`; the band cuts declared once in each half of
        // the
        // package; and what a plan is painted in. Every one of them draws a plausible wrong
        // picture rather than failing (#1144, #1147).
        //
        // It takes `AtlasLayout` directly as well, because this is the only place the two halves
        // can be compared: the layout half depends on no contract, so `AtlasLayoutTests` cannot
        // see `ArgoDesign` at all.
        .testTarget(name: "AtlasViewTests", dependencies: ["AtlasView", "AtlasLayout"]),
    ],
)
