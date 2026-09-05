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
    /// Size by `lines` and colour by `commits`, unchanged from the flat picture so the two ends of
    /// the camera can be compared frame against frame.
    ///
    /// Height is `commits` too, which the FIXTURE decides rather than a preference. Its five
    /// Measures over 89 files: `authors` is 1 for every one of them, `age_in_weeks` holds four
    /// values, `bytes` runs 359 B to 4.8 MB, `lines` is absent on twenty. `commits` spreads 1 to 13
    /// over eleven values, and it is the only one of the five that draws a skyline.
    static let channels = AtlasChannels(footprint: "lines", band: "commits", height: "commits")

    let ground: CGSize
    /// How much of the third dimension is left and how far the city has climbed out of its plates
    /// — 1 and 1 being the settled city (#1150, #1421). The rise is a PARAMETER rather than a
    /// clock the specimen starts, because a screenshot of a moving thing taken on a clock is a
    /// different picture every run; this way one frame of it is a state the harness names.
    let standing: AtlasStanding
    /// Nothing draws the map of a repository nobody has scanned: the floor, and no city on it.
    private let map: AtlasMap?
    /// The file to draw as OPEN, traced on the map (#1154). The room's own specimen renders the
    /// reading beside the treemap; this is the same mark on a city, which is the harder geometry —
    /// the roof, three standing corners and the foot, rather than one rectangle.
    private let open: String?

    init(
        ground: CGSize = CGSize(width: 1040, height: 660),
        standing: AtlasStanding = .city,
        map: AtlasMap? = try? AtlasMapFixture.argo(),
        open: String? = nil,
    ) {
        self.ground = ground
        self.standing = standing
        self.map = map
        self.open = open
    }

    var body: some View {
        AtlasView(plan: plan, standing: standing, focus: AtlasFocus(open: open) { _ in })
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
    AtlasMapSpecimen(standing: .flat)
        .frame(width: 1100, height: 800)
        .argoAppearance()
}

#Preview("Atlas — the city half risen") {
    AtlasMapSpecimen(standing: AtlasStanding(relief: 1, rise: 0.5))
        .frame(width: 1100, height: 800)
        .argoAppearance()
}
