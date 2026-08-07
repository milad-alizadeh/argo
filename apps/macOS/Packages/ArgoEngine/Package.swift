// swift-tools-version: 6.2
import PackageDescription

/// The domain and engine: transcript readers, the typed event model, the Hub's join.
/// No UI, no AppKit — so it stays testable from the command line (`swift test`).
let package = Package(
    name: "ArgoEngine",
    platforms: [.macOS("26.0")],
    products: [
        .library(name: "ArgoEngine", targets: ["ArgoEngine"]),
        // The engine with a face on it: what makes Phase 1 runnable and inspectable without a
        // window. It reads a real transcript, so the parse is exercised against the CLI's own
        // output rather than only against fixtures.
        .executable(name: "argo-observe", targets: ["argo-observe"]),
    ],
    targets: [
        .target(name: "ArgoEngine"),
        .executableTarget(name: "argo-observe", dependencies: ["ArgoEngine"]),
        .testTarget(
            name: "ArgoEngineTests",
            dependencies: ["ArgoEngine"],
            // The Electron reader's own fixtures, carried over unchanged: the point of porting
            // them is that both readers answer the same bytes, so editing one to suit Swift
            // would retire the only evidence that they agree.
            resources: [.copy("Fixtures")],
        ),
    ],
)
