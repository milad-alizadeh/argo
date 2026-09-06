import ArgoDesign
import ArgoUI
import AtlasFixtures
import AtlasLayout
import Foundation
import SwiftUI

/// The reader inside a folder: the map re-tiled to it, the trail saying how they got there, and the
/// control back out (#1156).
///
/// A specimen rather than a preview for `AtlasIndexSpecimen`'s reason, one gesture further along: a
/// folder is entered by clicking its plate, and no screenshot clicks. `AtlasRoomOpening(entered:)`
/// is the seam that stands it up, and nothing in the app ever passes one.
///
/// The committed measurement, so the trail carries the path lengths a real monorepo has — the
/// crumbs are a clipping and a wrapping problem, and a fixture of two tidy folders poses neither.
struct AtlasDescentSpecimen: View {
    var entered = AtlasDescentPaths.deep

    var body: some View {
        AtlasRoomHost(
            reading: .measured(descentFixtureMap),
            opening: AtlasRoomOpening(entered: entered),
        )
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .argoDeckSurface()
    }
}

/// Where the two frames stand, named rather than written inline for `AtlasReadingSpecimen.opened`'s
/// reason: a path that no longer names a folder of the fixture renders the WHOLE repository, which
/// is a specimen quietly drawing the state before the one it is for. `AtlasDescentSpecimenTests` is
/// what notices.
///
/// Beside the specimens rather than inside them, because a `View`'s statics are main-actor
/// isolated and these are read by a test's own arguments, which are not.
enum AtlasDescentPaths {
    /// Three levels down, which is the state worth a frame: deep enough that the trail has crumbs
    /// between the root and where the reader is, so the claim that every step is a control is
    /// visible rather than implied.
    static let deep = "argo/apps/macOS/Packages"

    /// One level down, and a folder measured in the same fixture.
    static let shallow = "argo/docs"
}

/// One level down: the shallowest descent there is, and the frame that shows the trail with exactly
/// one crumb in front of where you are.
struct AtlasDescentShallowSpecimen: View {
    var body: some View {
        AtlasDescentSpecimen(entered: AtlasDescentPaths.shallow)
    }
}

/// The committed measurement, or the floor with no city on it where the bundled fixture will not
/// load — a specimen that trapped would be a harness failure dressed as a product one.
private let descentFixtureMap = (try? AtlasMapFixture.argo())
    ?? AtlasMap(measuredAt: Date(), commit: nil, root: AtlasPlate(path: "empty", children: []))

#Preview("Atlas — inside a folder") {
    AtlasDescentSpecimen()
        .frame(width: 1280, height: 800)
        .argoAppearance()
}

#Preview("Atlas — one level down") {
    AtlasDescentShallowSpecimen()
        .frame(width: 1280, height: 800)
        .argoAppearance()
}
