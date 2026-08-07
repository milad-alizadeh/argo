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
    ],
    targets: [
        .target(name: "ArgoUI", dependencies: ["ArgoEngine"]),
        .testTarget(name: "ArgoUITests", dependencies: ["ArgoUI"]),
    ],
)
