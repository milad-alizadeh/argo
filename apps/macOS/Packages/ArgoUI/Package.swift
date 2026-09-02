// swift-tools-version: 6.2
import PackageDescription

/// Shared visual components: the window's content, and every view the rooms are built from.
///
/// It depends on ArgoEngine for the domain's own value types and for the one projection that
/// reads the Hub (`CockpitPresentation`). The rule the dependency does NOT relax is the view's:
/// a view takes `CockpitPresentation` and never the Hub, so nothing below the shell can reach
/// live state.
let package = Package(
    name: "ArgoUI",
    platforms: [.macOS("26.0")],
    products: [
        .library(name: "ArgoUI", targets: ["ArgoUI"]),
    ],
    dependencies: [
        .package(path: "../ArgoEngine"),
        // The token contract and the primitives over it, one layer below every view here (#1088).
        .package(path: "../ArgoDesign"),
        // Syntax highlighting: highlight.js under a SwiftUI surface, MIT. A grammar per language is
        // a solved problem and not one to hand-roll (`rules/dependencies.md`), and this one ships
        // Xcode's own theme, which is the theme the panel wants.
        .package(url: "https://github.com/appstefan/HighlightSwift.git", from: "1.1.0"),
    ],
    targets: [
        .target(
            name: "ArgoUI",
            dependencies: [
                "ArgoEngine",
                "HighlightSwift",
                .product(name: "ArgoDesign", package: "ArgoDesign"),
                .product(name: "ArgoAtoms", package: "ArgoDesign"),
            ],
        ),
        .testTarget(name: "ArgoUITests", dependencies: ["ArgoUI"]),
    ],
)
