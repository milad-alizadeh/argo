// swift-tools-version: 6.2
import PackageDescription

/// Shared visual components: the window's content, and every view the rooms are built from.
/// Deliberately independent of ArgoEngine — views take the data they render as arguments.
let package = Package(
    name: "ArgoUI",
    platforms: [.macOS("26.0")],
    products: [
        .library(name: "ArgoUI", targets: ["ArgoUI"]),
    ],
    targets: [
        .target(name: "ArgoUI"),
        .testTarget(name: "ArgoUITests", dependencies: ["ArgoUI"]),
    ],
)
