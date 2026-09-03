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
        // The dev-tool half, kept OUT of the library that draws the product. The app target links
        // this one too, because the specimen harness is reached by launch argument on the real
        // binary — that is what makes a specimen render evidence rather than a preview (#1085).
        .library(name: "ArgoSpecimens", targets: ["ArgoSpecimens"]),
    ],
    dependencies: [
        .package(path: "../ArgoEngine"),
        // The token contract and the primitives over it, one layer below every view here (#1088).
        .package(path: "../ArgoDesign"),
        // The `mermaid` renderer, which is a package rather than a leaf of the feed (#1087).
        .package(path: "../ArgoMermaid"),
        // Syntax highlighting: highlight.js under a SwiftUI surface, MIT. A grammar per language is
        // a solved problem and not one to hand-roll (`rules/house.md`), and this one ships
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
                .product(name: "ProseText", package: "ArgoDesign"),
                .product(name: "MermaidLayout", package: "ArgoMermaid"),
                .product(name: "MermaidView", package: "ArgoMermaid"),
            ],
        ),
        // Sample data, and nothing that draws: the transcripts the cockpit is judged against and
        // the Tickets they hang off. A leaf under both targets above it, so the fixtures cannot
        // reach a view and a view cannot reach a fixture.
        // `Fixtures/` is excluded rather than declared a resource: the settled-session synthetic
        // is read from the source tree by a suite and a generator, and `ArgoSpecimens` links this
        // target while the app links `ArgoSpecimens` — a resource here would ship a transcript
        // inside the product.
        // `ArgoDesign` is declared rather than borrowed: two files here import it, and SwiftPM
        // resolves that through ArgoUI's own dependency while `xcodebuild` does not — so an
        // undeclared edge compiles under `swift test` and fails the app build.
        .target(
            name: "ArgoFixtures",
            dependencies: ["ArgoEngine", .product(name: "ArgoDesign", package: "ArgoDesign")],
            exclude: ["Fixtures"],
        ),
        // The fixtures' own generator. An executable rather than a test, because writing a file
        // into the tree is not something a suite may do — and in this package because proving the
        // synthetic stands for its source means projecting both, which is ArgoUI's `package`
        // surface.
        .executableTarget(name: "argo-synthesise", dependencies: ["ArgoUI", "ArgoFixtures"]),
        // The specimen harness: the surfaces `scripts/specimens.sh` renders, the registry that
        // names them and the launch that dispatches to one. It sees ArgoUI's `package` surface,
        // and ArgoUI sees nothing of it.
        .target(
            name: "ArgoSpecimens",
            dependencies: [
                "ArgoUI",
                "ArgoFixtures",
                .product(name: "ArgoDesign", package: "ArgoDesign"),
                .product(name: "ArgoAtoms", package: "ArgoDesign"),
                .product(name: "MermaidLayout", package: "ArgoMermaid"),
                .product(name: "MermaidView", package: "ArgoMermaid"),
            ],
        ),
        .testTarget(
            name: "ArgoUITests",
            dependencies: [
                "ArgoUI",
                "ArgoFixtures",
                "ArgoSpecimens",
                .product(name: "MermaidLayout", package: "ArgoMermaid"),
            ],
        ),
    ],
)
