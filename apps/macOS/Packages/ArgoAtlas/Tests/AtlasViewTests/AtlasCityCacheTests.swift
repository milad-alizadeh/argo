import ArgoDesign
@testable import AtlasLayout
@testable import AtlasView
import CoreGraphics
import Testing

/// The city is built when the map changes, and never because the reader moved (#1598).
///
/// What the cache answers is the whole of what decides it: a city on the first ask, and NOTHING
/// where neither the plan nor the pigments have moved since. `AtlasVolumeRenderer.present` reaches
/// `show` only through a non-nil answer here, so these are the claims that make "a drag rebuilds no
/// city" true; `AtlasDragTests` drives `present` itself and says what the GPU does with it.
///
/// A camera drag leaves the plan and the pigments untouched by construction — `AtlasProjection`
/// carries the plan verbatim and a yaw cannot reach it. That is the point rather than a weakness of
/// the fixture, and the projections below are built anyway so the values handed over are the ones
/// the surface really hands over.
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

    static let ground = CGSize(width: 200, height: 150)

    /// A plate of files, every rect derived FROM the extent — so a plan tiled into a window of
    /// another size is a plan whose every box has moved, which is what a re-tile really is. A
    /// fixture whose rects came from the index alone would let a stale city pass a re-tile.
    static func plan(extent: CGSize = AtlasCityCacheTests.ground) -> AtlasPlan {
        let bands: [AtlasBand] = [.quiet, .middling, .hot]
        let across = 4
        let down = 3
        let cell = CGSize(
            width: extent.width / CGFloat(across), height: extent.height / CGFloat(down),
        )
        let tiles = (0 ..< across * down).map { (index: Int) -> AtlasTile in
            let x = CGFloat(index % across) * cell.width + 2
            let y = CGFloat(index / across) * cell.height + 4
            return AtlasTile(
                path: "argo/plate/file-\(index)",
                rect: CGRect(
                    x: x, y: y, width: cell.width - 4, height: cell.height - 8,
                ),
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
        #expect(city.volumes.map(\.origin) == expected.volumes.map(\.origin))
        #expect(city.volumes.map(\.pigment) == expected.volumes.map(\.pigment))
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
        let first = try #require(cache.rebuilt(of: plan, in: Self.pigments))

        let repainted = try #require(cache.rebuilt(of: plan, in: pigments))

        // Really repainted, and repainted the way a fresh build would be.
        #expect(repainted.volumes.map(\.pigment) != first.volumes.map(\.pigment))
        #expect(repainted.volumes.map(\.pigment)
            == AtlasVolumes.city(of: plan, in: pigments).volumes.map(\.pigment))
        // And the old pigments come back as a build of their own rather than as a hit on a
        // comparison that only ever looks at the plan.
        #expect(cache.rebuilt(of: plan, in: Self.pigments) != nil)
    }

    /// A re-tile is a new city. The window is what the extent is, and every rect in the plan is in
    /// its points — so a city the cache kept would draw the old window's boxes in the new one.
    @Test func `a re-tile builds the city again`() throws {
        let cache = AtlasCityCache()
        let first = try #require(cache.rebuilt(of: Self.plan(), in: Self.pigments))

        let resized = Self.plan(extent: CGSize(width: 320, height: 150))
        let city = try #require(cache.rebuilt(of: resized, in: Self.pigments))

        // Every box moved, and moved to where a fresh build puts it.
        #expect(city.volumes.map(\.origin) != first.volumes.map(\.origin))
        #expect(city.volumes.map(\.origin)
            == AtlasVolumes.city(of: resized, in: Self.pigments).volumes.map(\.origin))
        #expect(city.volumes.map(\.size)
            == AtlasVolumes.city(of: resized, in: Self.pigments).volumes.map(\.size))
        // The same plan handed back after it settles is not a third build.
        #expect(cache.rebuilt(of: resized, in: Self.pigments) == nil)
    }
}
