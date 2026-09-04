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
        ),
        .testTarget(
            name: "AtlasLayoutTests",
            dependencies: ["AtlasLayout"],
            // A real measurement of this repository, trimmed. Its own README states what was
            // measured and which awkward cases it was chosen to carry (#1145).
            resources: [.copy("Fixtures")],
        ),
    ],
)
