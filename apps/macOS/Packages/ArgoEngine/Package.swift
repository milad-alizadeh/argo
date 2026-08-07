// swift-tools-version: 6.2
import PackageDescription

// The domain and engine: transcript readers, the typed event model, the Hub's join.
// No UI, no AppKit — so it stays testable from the command line (`swift test`).
let package = Package(
    name: "ArgoEngine",
    platforms: [.macOS("26.0")],
    products: [
        .library(name: "ArgoEngine", targets: ["ArgoEngine"])
    ],
    targets: [
        .target(name: "ArgoEngine")
    ]
)
