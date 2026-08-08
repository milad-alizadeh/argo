// swift-tools-version: 6.2
import PackageDescription

/// The domain and engine: transcript readers, the typed event model, the Hub's join.
/// No UI, no AppKit — so it stays testable from the command line (`swift test`).
let package = Package(
    name: "ArgoEngine",
    platforms: [.macOS("26.0")],
    products: [
        .library(name: "ArgoEngine", targets: ["ArgoEngine"]),
        // The one adapter that cannot live in `ArgoEngine`: SwiftTerm links AppKit on macOS, and
        // the engine's whole point is that it runs with no window. A separate target keeps the
        // process host real and the engine command-line testable.
        .library(name: "ArgoTerminal", targets: ["ArgoTerminal"]),
        // The engine with a face on it: what makes Phase 1 runnable and inspectable without a
        // window. It reads a real transcript, so the parse is exercised against the CLI's own
        // output rather than only against fixtures.
        .executable(name: "argo-observe", targets: ["argo-observe"]),
    ],
    dependencies: [
        // SwiftTerm's `LocalProcess` is the PTY host, and `LocalProcessTerminalView` in the same
        // package is what the Dock draws over it (#387) — one process host under both.
        //
        // Held below 1.12 deliberately: that release added a Metal GPU renderer, and its `.metal`
        // shader makes an Xcode build require a separately-downloaded Metal Toolchain — on every
        // machine and on the macOS CI runner, for a renderer nothing here draws with. Revisit when
        // #387 decides whether the Dock wants it; `LocalProcess` is identical either side.
        .package(url: "https://github.com/migueldeicaza/SwiftTerm", "1.2.0" ..< "1.12.0"),
    ],
    targets: [
        .target(
            name: "ArgoEngine",
            // The companion plugin the spawn loads: a real `.claude-plugin` directory, carried as
            // a resource so the built app ships the same bytes a checkout runs against.
            resources: [.copy("Companion/Plugin")],
        ),
        .target(name: "ArgoTerminal", dependencies: ["ArgoEngine", "SwiftTerm"]),
        .executableTarget(name: "argo-observe", dependencies: ["ArgoEngine"]),
        .testTarget(
            name: "ArgoEngineTests",
            dependencies: ["ArgoEngine"],
            // The Electron reader's own fixtures, carried over unchanged: the point of porting
            // them is that both readers answer the same bytes, so editing one to suit Swift
            // would retire the only evidence that they agree.
            resources: [.copy("Fixtures")],
        ),
        .testTarget(name: "ArgoTerminalTests", dependencies: ["ArgoTerminal"]),
    ],
)
