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
        // Syntax highlighting, which is a solved problem and not one to hand-roll a grammar per
        // language for (`rules/dependencies.md`). highlight.js under a SwiftUI surface: MIT, the
        // languages a transcript actually carries, and a CUSTOM theme — which is the reason it is
        // this one rather than a wrapper with a fixed theme list. Argo supplies the colours.
        .package(url: "https://github.com/appstefan/HighlightSwift.git", from: "1.1.0"),
    ],
    targets: [
        .target(name: "ArgoUI", dependencies: ["ArgoEngine", "HighlightSwift"]),
        .testTarget(name: "ArgoUITests", dependencies: ["ArgoUI"]),
    ],
)
