import ArgoDesign
import ArgoUI
import AtlasFixtures
import AtlasLayout
import Foundation
import SwiftUI

/// The map re-tiled by inferred domain: a subject spread over five folders drawn as one region,
/// coloured by the promoted wheel and washed out by how sure the guess was (#1158).
///
/// A specimen rather than a preview for `AtlasDescentSpecimen`'s reason: the map is re-tiled by
/// pressing a control, and no screenshot presses one. `AtlasRoomOpening(grouped:)` is the seam
/// that stands it up, and nothing in the app ever passes one.
///
/// The committed measurement, so the regions are the shipped clusterer's own guess over real
/// filenames and a real history — nine of them, with twelve files in none. A fixture of two tidy
/// domains would pose neither of the two problems the picture has to survive: a wheel that has to
/// stay clear of every grey on the map, and a region for the files that belong nowhere.
///
/// The room ships FLAT, which is where the plates carry their names — so this is the frame where
/// a region can be read as the subject it is. The city draws the same regions in the same colours
/// and captions none of them (`AtlasView`, and the reason it does).
struct AtlasDomainsSpecimen: View {
    var body: some View {
        AtlasRoomHost(
            reading: .measured(domainsFixtureMap),
            opening: AtlasRoomOpening(grouped: .domains),
        )
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .argoDeckSurface()
    }
}

/// The same reading inside one region: the reader followed a subject in, and the trail says which
/// one — the state that proves a region is a PLACE rather than a block of colour.
struct AtlasDomainsInsideSpecimen: View {
    var body: some View {
        AtlasRoomHost(
            reading: .measured(domainsFixtureMap),
            opening: AtlasRoomOpening(entered: AtlasDomainPaths.region, grouped: .domains),
        )
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .argoDeckSurface()
    }
}

/// Where the second frame stands, named rather than written inline for `AtlasDescentPaths`'
/// reason: a path that no longer names a region of the fixture renders the WHOLE map, which is a
/// specimen quietly drawing the state before the one it is for.
///
/// Beside the specimens rather than inside them, because a `View`'s statics are main-actor
/// isolated and these are read by a test's own arguments, which are not.
enum AtlasDomainPaths {
    /// The largest region of the committed measurement — fourteen files, named for the word most
    /// concentrated in them — under the namespace `AtlasMap.regrouped()` stands every region in,
    /// which is what tells a region from a folder that happens to share its name.
    static let region = "argo/@domain/evidence"
}

/// The committed measurement, or the floor with no city on it where the bundled fixture will not
/// load — a specimen that trapped would be a harness failure dressed as a product one.
private let domainsFixtureMap = (try? AtlasMapFixture.argo())
    ?? AtlasMap(measuredAt: Date(), commit: nil, root: AtlasPlate(path: "empty", children: []))

#Preview("Atlas — the map re-tiled by domain") {
    AtlasDomainsSpecimen()
        .frame(width: 1280, height: 800)
        .argoAppearance()
}

#Preview("Atlas — inside one domain") {
    AtlasDomainsInsideSpecimen()
        .frame(width: 1280, height: 800)
        .argoAppearance()
}
