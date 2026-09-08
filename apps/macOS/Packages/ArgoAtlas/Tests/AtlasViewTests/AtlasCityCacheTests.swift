import ArgoDesign
@testable import AtlasLayout
@testable import AtlasView
import CoreGraphics
import Testing

/// The city is built when the map changes, and never because the reader moved (#1598).
///
/// A camera drag writes an orientation into a binding, SwiftUI runs the body, and `AtlasSurface` is
/// handed the same plan and the same pigments it had the frame before. What is asked here is what
/// comes back from that ask: a city on the frame that first has one, and NOTHING on every frame of
/// the drag after it — because the boxes are already on the GPU and building them again was over
/// 6000 structs on the main actor, once per frame.
///
/// The projections are the real ones, solved off `AtlasCamera` the way the surface solves them, so
/// the claim is about a drag rather than about a comparison of two values chosen to be equal.
@Suite("Atlas — the city is built when the map moves, not when the reader does")
struct AtlasCityCacheTests {
    static let pigments = AtlasPigments(
        ArgoPalette.graphite.atlas,
        rim: ArgoPalette.graphite.edge.hairline,
    )

    /// The measure ramp with its ends swapped: every file on the map is repainted, and nothing
    /// about the plan has moved. What an appearance change looks like from here.
    static let repainted = AtlasPigments(
        ArgoPalette.AtlasRoles(
            measure: ArgoPalette.MeasureRoles(
                quiet: ArgoPalette.graphite.atlas.measure.hot,
                middling: ArgoPalette.graphite.atlas.measure.middling,
                hot: ArgoPalette.graphite.atlas.measure.quiet,
            ),
            domain: ArgoPalette.graphite.atlas.domain,
            materials: ArgoPalette.graphite.atlas.materials,
            marks: ArgoPalette.graphite.atlas.marks,
        ),
        rim: ArgoPalette.graphite.edge.hairline,
    )

    /// The same families, with the plate borders taken from another role — the `edge` half of the
    /// pigments rather than the atlas half.
    static let rerimmed = AtlasPigments(
        ArgoPalette.graphite.atlas,
        rim: ArgoPalette.graphite.edge.subtle,
    )

    static func plan(extent: CGSize = CGSize(width: 200, height: 150)) -> AtlasPlan {
        let bands: [AtlasBand] = [.quiet, .middling, .hot]
        let tiles = (0 ..< 12).map { (index: Int) -> AtlasTile in
            let x = CGFloat(index % 4) * 48 + 4
            let y = CGFloat(index / 4) * 44 + 6
            return AtlasTile(
                path: "argo/plate/file-\(index)",
                rect: CGRect(x: x, y: y, width: 44, height: 40),
                band: bands[index % bands.count],
                height: CGFloat(6 + index * 3),
            )
        }
        return AtlasPlan(
            extent: extent,
            plates: [.init(
                path: "argo/plate", rect: CGRect(origin: .zero, size: extent), depth: 0,
            )],
            tiles: tiles,
        )
    }

    /// One frame of a drag: the same plan, turned.
    static func projection(of plan: AtlasPlan, yaw: Double, rising rise: Double = 1)
        -> AtlasProjection {
        AtlasProjection(
            of: plan,
            through: AtlasCamera(
                relief: 1,
                orientation: AtlasOrientation(yaw: yaw, pitch: 0.6155),
                over: plan.extent,
            ),
            rising: rise,
        )
    }

    /// The first ask has nothing on the GPU to compare against, so it builds — and what it builds
    /// is the whole city, not a stand-in for one.
    @Test func `the first ask builds the map the plan describes`() throws {
        let cache = AtlasCityCache()
        let plan = Self.plan()

        let city = try #require(cache.rebuilt(of: plan, in: Self.pigments))

        let expected = AtlasVolumes.city(of: plan, in: Self.pigments)
        #expect(city.volumes.count == expected.volumes.count)
        #expect(city.roster == expected.roster)
        #expect(city.volumes.map(\.id) == expected.volumes.map(\.id))
    }

    /// THE CLAIM. Twenty-four frames of a drag over one plan, and one city built between them.
    @Test func `a drag of the camera builds no city`() {
        let cache = AtlasCityCache()
        let plan = Self.plan()

        var built = 0
        for step in 0 ..< 24 {
            let turned = Self.projection(of: plan, yaw: Double(step) * 0.05)
            if cache.rebuilt(of: turned.plan, in: Self.pigments) != nil {
                built += 1
            }
        }

        // The first frame of the drag is the first frame there has ever been, so it builds. The
        // twenty-three after it are the claim.
        #expect(built == 1)
    }

    /// The rise runs on its own clock and lifts every box in the map (#1421), and it is still not
    /// a new city: the boxes carry their measured heights and the shader climbs them.
    @Test func `a rise builds no city either`() {
        let cache = AtlasCityCache()
        let plan = Self.plan()
        _ = cache.rebuilt(of: plan, in: Self.pigments)

        var built = 0
        for step in 0 ... 20 {
            let climbing = Self.projection(of: plan, yaw: .pi / 4, rising: Double(step) / 20)
            if cache.rebuilt(of: climbing.plan, in: Self.pigments) != nil {
                built += 1
            }
        }

        #expect(built == 0)
    }

    /// A repaint IS a new city: what a face is painted in is decided before the GPU sees it, so a
    /// pigment nobody rebuilt for is a map still drawn in the appearance the reader left.
    @Test(arguments: [AtlasCityCacheTests.repainted, AtlasCityCacheTests.rerimmed])
    func `a pigment change builds the city again`(pigments: AtlasPigments) throws {
        let cache = AtlasCityCache()
        let plan = Self.plan()
        _ = cache.rebuilt(of: plan, in: Self.pigments)

        let repainted = try #require(cache.rebuilt(of: plan, in: pigments))

        let expected = AtlasVolumes.city(of: plan, in: pigments)
        #expect(repainted.volumes.map(\.pigment) == expected.volumes.map(\.pigment))
        // And the old pigments come back as a build of their own rather than as a cache hit on a
        // comparison that only ever looks at the plan.
        #expect(cache.rebuilt(of: plan, in: Self.pigments) != nil)
    }

    /// A re-tile is a new city, and so is a plan tiled into a window of a different size: the
    /// window is what the extent is, and every rect in the plan is in its points.
    @Test func `a re-tile builds the city again`() throws {
        let cache = AtlasCityCache()
        _ = cache.rebuilt(of: Self.plan(), in: Self.pigments)

        let resized = Self.plan(extent: CGSize(width: 260, height: 150))
        let city = try #require(cache.rebuilt(of: resized, in: Self.pigments))

        #expect(city.volumes.count == AtlasVolumes.city(of: resized, in: Self.pigments)
            .volumes.count)
        // The same plan handed back after it settles is not a third build.
        #expect(cache.rebuilt(of: resized, in: Self.pigments) == nil)
    }
}
