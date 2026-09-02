// swift-tools-version: 6.2
import PackageDescription

/// The token contract, and the primitives handed out over it.
///
/// It is a leaf: SwiftUI, AppKit and Foundation, and nothing of Argo's. That is the whole point
/// of the package — while the contract shared a module with the 47,000 lines of view code that
/// consume it, a colour literal in a view was indistinguishable, to every script this repo runs,
/// from a colour literal in the palette that defines the ramp. Apart, edge 7 of
/// `scripts/swift-boundaries.sh` can say the difference in a grep (#1088).
let package = Package(
    name: "ArgoDesign",
    platforms: [.macOS("26.0")],
    products: [
        .library(name: "ArgoDesign", targets: ["ArgoDesign"]),
        .library(name: "ArgoAtoms", targets: ["ArgoAtoms"]),
    ],
    targets: [
        .target(name: "ArgoDesign"),
        .target(name: "ArgoAtoms", dependencies: ["ArgoDesign"]),
    ],
)
