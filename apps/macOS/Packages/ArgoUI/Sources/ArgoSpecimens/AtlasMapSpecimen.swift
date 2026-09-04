import ArgoDesign
import AtlasFixtures
import AtlasLayout
import AtlasView
import SwiftUI

/// The map of this repository, at one end of the camera or the other: the city, or the same
/// tiling seen straight down, with the key that says what its colour is worth (#1147, #1150).
///
/// One specimen and one `relief` rather than two views, because that is the claim the drawing
/// makes: there is ONE camera, and the treemap is what it draws at the flat end of it. Two
/// specimen types here would be two pictures nobody could tell had drifted apart.
///
/// It is a specimen rather than a preview because the question it answers cannot be answered in
/// Xcode. A `#Preview` renders on the machine that has the Metal Toolchain installed; the claim
/// worth holding is that the SHIPPED binary draws the city, and only a screenshot of the running
/// app says that.
///
/// It draws the committed measurement rather than a tidy invention, for the reason the fixture
/// exists: 89 real files, eleven levels of nesting, one file 78× the median and twenty carrying no
/// `lines` at all. A city judged on tidy numbers is a city judged on the one repository that does
/// not exist.
struct AtlasMapSpecimen: View {
    /// Size by `lines` and colour by `commits`, which is what the flat picture shipped as and is
    /// left alone so the two ends of the camera can be compared frame against frame.
    ///
    /// Height is `commits` as well, and that is the FIXTURE's limit rather than a preference: of
    /// the three Measures left, `authors` is 1 for all 89 files and would stand the whole city at
    /// one height, `age_in_weeks` holds four values and draws plateaus, and `bytes` has one file
    /// 4.8 MB against a median in the kilobytes — one tower over a plain. `commits` spreads 1 to
    /// 13 over eleven values, which is the only skyline this measurement can draw, and a skyline
    /// is what a projection and a depth order have to be judged on.
    static let channels = AtlasChannels(footprint: "lines", band: "commits", height: "commits")

    let ground: CGSize
    /// How much of the third dimension is left: 1 the city, 0 the treemap.
    let relief: Double
    /// Nothing draws the map of a repository nobody has scanned: the floor, and no city on it.
    private let map: AtlasMap?

    init(
        ground: CGSize = CGSize(width: 1040, height: 660),
        relief: Double = 1,
        map: AtlasMap? = try? AtlasMapFixture.argo(),
    ) {
        self.ground = ground
        self.relief = relief
        self.map = map
    }

    var body: some View {
        AtlasView(plan: plan, relief: relief)
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

#Preview("Atlas — the city") {
    AtlasMapSpecimen()
        .frame(width: 1100, height: 800)
        .argoAppearance()
}

#Preview("Atlas — the map tiled flat") {
    AtlasMapSpecimen(relief: 0)
        .frame(width: 1100, height: 800)
        .argoAppearance()
}
