import ArgoDesign
import AtlasFixtures
import AtlasLayout
import AtlasView
import SwiftUI

/// The map's first picture: this repository, tiled flat, with the key that says what its colour is
/// worth (#1147).
///
/// It is a specimen rather than a preview because the question it answers cannot be answered in
/// Xcode. A `#Preview` renders on the machine that has the Metal Toolchain installed; the claim
/// worth holding is that the SHIPPED binary draws the city, and only a screenshot of the running
/// app says that.
///
/// It draws the committed measurement rather than a tidy invention, for the reason the fixture
/// exists: 89 real files, eleven levels of nesting, one file 78× the median and twenty carrying no
/// `lines` at all. A treemap judged on tidy numbers is a treemap judged on the one repository that
/// does not exist.
struct AtlasTreemapSpecimen: View {
    /// Size by `lines` and colour by `commits`: two different Measures, so nothing in the picture
    /// can be read off one channel and mistaken for the other.
    static let channels = AtlasChannels(footprint: "lines", band: "commits")

    let ground: CGSize
    /// Nothing draws the map of a repository nobody has scanned: the floor, and no city on it.
    private let map: AtlasMap?

    init(
        ground: CGSize = CGSize(width: 1040, height: 660),
        map: AtlasMap? = try? AtlasMapFixture.argo(),
    ) {
        self.ground = ground
        self.map = map
    }

    var body: some View {
        AtlasView(plan: plan)
            .padding(ArgoSpacing.section)
            .argoDeckSurface()
    }

    /// No map is the GROUND and no city on it, not `AtlasPlan.empty` — that one has a zero extent,
    /// so it draws nothing at all, and nothing is indistinguishable from a view that failed to
    /// paint. This is the floor at full size: the state before anything has been scanned, and the
    /// one every way Metal can be absent degrades to. A fixture that could not be read lands here
    /// too, because a specimen that trapped would be a harness failure dressed as a product one.
    private var plan: AtlasPlan {
        guard let map else { return AtlasPlan(extent: ground) }
        return AtlasPlan(tiling: map, by: Self.channels, into: ground)
    }
}

#Preview("Atlas — the map tiled flat") {
    AtlasTreemapSpecimen()
        .frame(width: 1100, height: 800)
        .argoAppearance()
}
