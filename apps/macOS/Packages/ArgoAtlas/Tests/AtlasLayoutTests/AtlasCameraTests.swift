import AtlasFixtures
@testable import AtlasLayout
import CoreGraphics
import Foundation
import Testing

/// The claim the two views rest on: they are ONE camera, and the flat end of it is the treemap
/// (#1150).
///
/// The identity is asserted here rather than eyeballed, because the failure it guards against is
/// invisible: a city that projects correctly and a flat map two points off the tiling it was drawn
/// from look equally right on their own, and only a number says the second one moved.
@Suite("Atlas — one camera, two views")
struct AtlasCameraTests {
    static let ground = CGSize(width: 800, height: 600)

    /// A plan with a root plate covering the whole ground, which is what the tiler always makes,
    /// and three files standing at three different heights.
    static func plan() -> AtlasPlan {
        AtlasPlan(
            extent: ground,
            plates: [.init(path: "a", rect: CGRect(origin: .zero, size: ground), depth: 0)],
            tiles: [
                .init(
                    path: "a/one",
                    rect: CGRect(x: 100, y: 50, width: 200, height: 120),
                    band: .hot,
                    height: 90,
                ),
                .init(
                    path: "a/two",
                    rect: CGRect(x: 300, y: 50, width: 500, height: 120),
                    band: .quiet,
                    height: 12,
                ),
                .init(
                    path: "a/three",
                    rect: CGRect(x: 0, y: 170, width: 800, height: 430),
                    band: nil,
                    height: 1.2,
                ),
            ],
        )
    }

    /// Where a plan point landed on the map BEFORE any of this existed: `AtlasVolume.metal`'s own
    /// two lines, spelled out here so the identity is checked against the picture that shipped
    /// rather than against a second copy of the new arithmetic.
    static func treemapClip(_ point: CGPoint, in extent: CGSize) -> CGPoint {
        CGPoint(
            x: point.x / extent.width * 2 - 1,
            y: 1 - point.y / extent.height * 2,
        )
    }

    static func clip(_ point: CGPoint, through camera: AtlasCamera, of plan: AtlasPlan) -> CGPoint {
        let fit = AtlasFit(framing: plan, through: camera, into: plan.extent)
        return fit.clip(camera.project(x: point.x, y: point.y, height: 0))
    }

    /// THE identity. Every corner of every tile, at the flat camera, lands where the flat shader
    /// put it — so switching to the city and back is a return rather than a redraw of a map that
    /// moved.
    @Test func `at the flat camera every corner lands where the treemap drew it`() {
        let plan = Self.plan()
        let camera = AtlasCamera.flat(over: plan.extent)

        for tile in plan.tiles {
            for corner in [
                CGPoint(x: tile.rect.minX, y: tile.rect.minY),
                CGPoint(x: tile.rect.maxX, y: tile.rect.maxY),
            ] {
                let drawn = Self.clip(corner, through: camera, of: plan)
                let before = Self.treemapClip(corner, in: plan.extent)
                #expect(abs(drawn.x - before.x) < 0.000_001)
                #expect(abs(drawn.y - before.y) < 0.000_001)
            }
        }
    }

    /// The heights are the other half of the identity: at the flat camera a tower and a flat tile
    /// are the same picture, so a file's own height cannot move it.
    @Test func `at the flat camera a height moves nothing`() {
        let plan = Self.plan()
        let camera = AtlasCamera.flat(over: plan.extent)

        let ground = camera.project(x: 400, y: 300, height: 0)
        let roof = camera.project(x: 400, y: 300, height: 150)

        #expect(abs(roof.x - ground.x) < 0.000_001)
        #expect(abs(roof.y - ground.y) < 0.000_001)
    }

    /// The city end, and the one thing that makes it a city: a taller file draws further UP the
    /// picture than a shorter one on the same ground.
    @Test func `at the city camera a taller file reaches further up the picture`() {
        let camera = AtlasCamera.city(over: Self.ground)

        let low = camera.project(x: 400, y: 300, height: 10)
        let high = camera.project(x: 400, y: 300, height: 120)

        #expect(high.y > low.y)
    }

    /// The eye is finite at the city end and infinite at the flat one, which is what the parameter
    /// pushing it away MEANS. Read off the picture rather than off the field: two rects of equal
    /// size at different distances come out different sizes through a finite eye and the same size
    /// through an infinite one.
    @Test func `the eye is finite in the city and infinite flat`() {
        let near = CGRect(x: 300, y: 500, width: 100, height: 40)
        let far = CGRect(x: 300, y: 60, width: 100, height: 40)

        let city = AtlasCamera.city(over: Self.ground)
        #expect(Self.spread(of: near, through: city) > Self.spread(of: far, through: city) * 1.01)

        let flat = AtlasCamera.flat(over: Self.ground)
        let flatNear = Self.spread(of: near, through: flat)
        #expect(abs(flatNear / Self.spread(of: far, through: flat) - 1) < 0.000_001)
    }

    /// What the depth test orders by: a file at the near edge of the plan is nearer than one at
    /// the far edge, and flat on nothing is nearer than anything — which is what leaves the
    /// treemap's own paint order in charge at that end.
    @Test func `the near edge of the plan is nearer than the far edge`() {
        let city = AtlasCamera.city(over: Self.ground)
        #expect(city.away(x: 0, y: 0, height: 0) < city.away(x: 800, y: 600, height: 0))

        let flat = AtlasCamera.flat(over: Self.ground)
        #expect(flat.away(x: 0, y: 0, height: 0) == flat.away(x: 800, y: 600, height: 0))
    }

    /// The parameter is one number and it is clamped, so nothing downstream draws a picture from a
    /// relief nobody could have meant.
    @Test(arguments: [(-1.0, 0.0), (0.0, 0.0), (0.5, 0.5), (1.0, 1.0), (4.0, 1.0)])
    func `the relief is held between the two views`(given: Double, held: Double) {
        #expect(AtlasCamera(relief: given, over: Self.ground).relief == held)
    }

    /// The whole real map framed, which is the case a fit can silently get wrong: the tallest
    /// tower is nowhere near a corner, so a fit that reserved the far corner's full height would
    /// leave a band of nothing under the city.
    @Test func `the city fills the frame it is fitted into`() throws {
        let map = try AtlasMapFixture.argo()
        let plan = AtlasPlan(tiling: map, by: AtlasChannels("lines"), into: Self.ground)
        let camera = AtlasCamera.city(over: plan.extent)

        let fit = AtlasFit(framing: plan, through: camera, into: Self.ground)

        let drawn = plan.tiles.flatMap { tile in
            [0 as CGFloat, tile.height].flatMap { height in
                [
                    (tile.rect.minX, tile.rect.minY), (tile.rect.maxX, tile.rect.minY),
                    (tile.rect.maxX, tile.rect.maxY), (tile.rect.minX, tile.rect.maxY),
                ].map { fit.clip(camera.project(x: $0.0, y: $0.1, height: height)) }
            }
        }
        #expect(drawn.allSatisfy { abs($0.x) <= 1 && abs($0.y) <= 1 })
        // Touching an edge is the claim: framed with room to spare is a map drawn smaller than the
        // window it was given.
        #expect(drawn.contains { abs($0.x) > 0.9 || abs($0.y) > 0.9 })
    }

    /// How wide a rect comes out, in clip units — the reading the perspective claim above is made
    /// from.
    static func spread(of rect: CGRect, through camera: AtlasCamera) -> Double {
        let left = camera.project(x: rect.minX, y: rect.midY, height: 0)
        let right = camera.project(x: rect.maxX, y: rect.midY, height: 0)
        return Double(hypot(right.x - left.x, right.y - left.y))
    }

    /// The flat end of the identity does not depend on `orientation` — a turned city still lies
    /// down onto exactly the treemap, which is what lets the reader turn the city, drop to the
    /// treemap and come back without the turn having leaked into the flat picture (#1152).
    @Test func `a turned city still reduces to the treemap at the flat end`() {
        let plan = Self.plan()
        let turned = AtlasOrientation(yaw: 1.4, pitch: 1.0)
        let camera = AtlasCamera(relief: 0, orientation: turned, over: plan.extent)

        for tile in plan.tiles {
            let corner = CGPoint(x: tile.rect.minX, y: tile.rect.minY)
            let drawn = Self.clip(corner, through: camera, of: plan)
            let before = Self.treemapClip(corner, in: plan.extent)
            #expect(abs(drawn.x - before.x) < 0.000_001)
            #expect(abs(drawn.y - before.y) < 0.000_001)
        }
    }

    /// The city end reads the turn back exactly, so a reader who drags the orbit ball sees the
    /// angle they set rather than one damped or offset by the camera around it.
    @Test func `the city camera turns to the orientation it is given`() {
        let turned = AtlasOrientation(yaw: AtlasOrientation.opening.yaw + 0.3, pitch: 0.9)
        let camera = AtlasCamera.city(over: Self.ground, orientation: turned)

        #expect(camera.turn.sinYaw == sin(turned.yaw))
        #expect(camera.turn.cosYaw == cos(turned.yaw))
        #expect(camera.turn.sinPitch == sin(turned.pitch))
        #expect(camera.turn.cosPitch == cos(turned.pitch))
    }
}
