// swift-tools-version: 6.2
import PackageDescription

/// The Atlas: a repository read as a city, tiled, banded and drawn (#1140).
///
/// A package of its own for the reason ADR-0022 splits the engine off and #1087 split the mermaid
/// renderer off after it: the layout half is not a view. It tiles a tree, bands a measure and picks
/// a plot under a cursor, and none of that needs a window.
///
/// Two targets, mirroring `ArgoMermaid`: `AtlasLayout` answers geometry and imports no UI
/// framework, so it runs under `swift test`; `AtlasView` draws what it decided. Edge 2 of
/// `scripts/swift-boundaries.sh` holds the first half.
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
    ],
    dependencies: [
        .package(path: "../ArgoDesign"),
    ],
    targets: [
        .target(name: "AtlasLayout"),
        .target(
            name: "AtlasView",
            dependencies: [
                "AtlasLayout",
                .product(name: "ArgoDesign", package: "ArgoDesign"),
            ],
            // `AtlasQuad.metal` is declared because the two build systems that read this manifest
            // disagree about it, and only one of them says so (#1144). Xcode compiles it — that is
            // what `CompileMetalFile` in an `xcodebuild` log is — while SwiftPM's own build does
            // not know the extension at all and drops it with an "unhandled file" warning.
            // Declaring it settles both: Xcode still compiles it into the target's
            // `default.metallib`, and `swift build` stops warning and starts generating
            // `Bundle.module`, which is what `AtlasQuadRenderer` loads the library from. A
            // `swift test` binary therefore carries the source and no metallib, and the renderer
            // answers that the way it answers a machine with no GPU: it returns nil and the map
            // shows its floor.
            resources: [.process("AtlasQuad.metal")],
        ),
        .testTarget(
            name: "AtlasLayoutTests",
            dependencies: ["AtlasLayout"],
            // A real measurement of this repository, trimmed. Its own README states what was
            // measured and which awkward cases it was chosen to carry (#1145).
            resources: [.copy("Fixtures")],
        ),
        // The drawing half has a suite for one reason: the uniform struct it hands the GPU is
        // declared twice, once here and once in `AtlasQuad.metal`, and a disagreement between them
        // draws a plausible wrong picture rather than failing (#1144).
        .testTarget(name: "AtlasViewTests", dependencies: ["AtlasView"]),
    ],
)
