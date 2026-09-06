// swift-tools-version: 6.2
import PackageDescription

/// The `mermaid` renderer: fourteen grammars read, laid out and drawn.
///
/// A package of its own rather than a folder in `ArgoUI` because the layout half is not a view. It
/// scans a fence, ranks a graph and measures words, and none of that needs a window — but while it
/// sat under the shell, nothing could say so, and 16% of `ArgoUI` was filed as a leaf of the feed
/// (#1087).
///
/// Two targets, for the reason ADR-0022 splits `ArgoEngine` off: `MermaidLayout` answers geometry
/// and imports no UI framework, so it runs under `swift test`; `MermaidView` draws what it decided.
/// Edge 2 of `scripts/swift-boundaries.sh` holds the first half.
let package = Package(
    name: "ArgoMermaid",
    platforms: [.macOS("26.0")],
    products: [
        .library(name: "MermaidLayout", targets: ["MermaidLayout"]),
        .library(name: "MermaidView", targets: ["MermaidView"]),
    ],
    dependencies: [
        .package(path: "../ArgoDesign"),
    ],
    targets: [
        .target(
            name: "MermaidLayout",
            dependencies: [
                .product(name: "ArgoDesign", package: "ArgoDesign"),
                .product(name: "ProseText", package: "ArgoDesign"),
            ],
        ),
        .target(
            name: "MermaidView",
            dependencies: [
                "MermaidLayout",
                .product(name: "ArgoAtoms", package: "ArgoDesign"),
                .product(name: "ArgoDesign", package: "ArgoDesign"),
            ],
        ),
        .testTarget(
            name: "MermaidLayoutTests",
            dependencies: [
                "MermaidLayout",
                .product(name: "ArgoDesign", package: "ArgoDesign"),
                .product(name: "ProseText", package: "ArgoDesign"),
            ],
        ),
    ],
)
