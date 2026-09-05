import AtlasFixtures
@testable import AtlasLayout
import CoreGraphics
import Foundation
import Testing

/// The move itself: the city lying down into the treemap, and standing back up (#1422).
///
/// `AtlasCameraTests` holds the two ENDS — that the flat camera is the treemap byte for byte, and
/// that the city fills the frame it is fitted into. What is asserted here is everything BETWEEN
/// them, which is the half a picture of either end cannot show: that the framing is solved again at
/// each step rather than held from the start, that the heights and the camera run on one clock, and
/// that the move settles on an exact 0 or an exact 1 rather than near one.
@Suite("Atlas — the city lies down")
struct AtlasLieDownTests {
    static let ground = CGSize(width: 800, height: 600)

    /// The real repository's map, which is the one a fit can silently get wrong: the tallest tower
    /// is nowhere near a corner, so what the framing has to reserve changes as the towers sink.
    static func plan() throws -> AtlasPlan {
        try AtlasPlan(tiling: AtlasMapFixture.argo(), by: AtlasChannels("lines"), into: ground)
    }

    /// Every corner the picture has: each box's four, at its floor and at its roof, and the four of
    /// the GROUND under all of them.
    ///
    /// The ground is not decoration in this reading — it is what reaches furthest at the flat end,
    /// where every tower has sunk into it, and `AtlasFit` frames it for exactly that reason. A
    /// sample that left it out would report the map short of its own extent and blame the fit.
    static func corners(of plan: AtlasPlan) -> [Corner] {
        let ground = CGRect(origin: .zero, size: plan.extent)
        return (plan.tiles.map { ($0.rect, $0.height) } + [(ground, 0)])
            .flatMap { rect, height in
                [0 as CGFloat, height].flatMap { raised in
                    [
                        (rect.minX, rect.minY), (rect.maxX, rect.minY),
                        (rect.maxX, rect.maxY), (rect.minX, rect.maxY),
                    ].map { Corner(x: $0.0, y: $0.1, height: raised) }
                }
            }
    }

    /// One corner of the picture, in the plan's own coordinates.
    struct Corner {
        let x: CGFloat
        let y: CGFloat
        let height: CGFloat
    }

    /// Where the picture reaches at one relief, in the view's own points — through the projection
    /// the room actually builds for that step.
    ///
    /// The orientation is a parameter because `AtlasView` passes one: the reader may drive the
    /// camera and flip from wherever they left it, and a refit proved at the opening angle alone
    /// would be proved for the one turn nobody had touched.
    static func drawn(
        _ plan: AtlasPlan,
        at relief: Double,
        turned: AtlasOrientation = .opening,
    )
        -> [CGPoint] {
        let projection = AtlasProjection(
            of: plan,
            through: AtlasCamera(relief: relief, orientation: turned, over: plan.extent),
        )
        return corners(of: plan).map {
            projection.viewPoint(x: $0.x, y: $0.y, height: $0.height)
        }
    }

    /// The same reading through a framing solved for ANOTHER step: the stale fit the refit exists
    /// to avoid. No shipped path can produce it — `AtlasProjection` solves its own — which is why
    /// it is assembled by hand here, as the control the claim above is only a claim against.
    static func drawnStale(
        _ plan: AtlasPlan,
        at relief: Double,
        through held: AtlasFit,
    )
        -> [CGPoint] {
        let camera = AtlasCamera(relief: relief, over: plan.extent)
        return corners(of: plan).map { corner in
            let clip = held.clip(camera.project(x: corner.x, y: corner.y, height: corner.height))
            return CGPoint(
                x: (clip.x + 1) / 2 * plan.extent.width,
                y: (1 - clip.y) / 2 * plan.extent.height,
            )
        }
    }

    /// How near the edge of its extent a picture reaches, as a fraction of the extent: 1 touches an
    /// edge, and anything short of it is a map drawn smaller than the stage it was given.
    static func reach(_ drawn: [CGPoint], in extent: CGSize) -> CGFloat {
        drawn.reduce(0) { furthest, point in
            max(
                furthest,
                max(
                    abs(point.x / extent.width * 2 - 1),
                    abs(point.y / extent.height * 2 - 1),
                ),
            )
        }
    }

    /// The steps the move is read at. The ends are in, because a claim made about the middle alone
    /// is one the two static pictures could still break.
    static let steps: [Double] = (0 ... 8).map { Double($0) / 8 }

    /// The claim the ticket asks to be proved rather than assumed: the framing is rebuilt at every
    /// step, not solved once at the start and reused. `AtlasProjection.init` builds an `AtlasFit`,
    /// `AtlasView` computes its projection fresh on every draw, and `Animatable` gives it one draw
    /// per frame — so a fit that were held would be one that never changed as the towers sank.
    @Test func `the framing is solved again at every step of the move`() throws {
        let plan = try Self.plan()
        let fits = Self.steps.map { relief in
            AtlasProjection(
                of: plan,
                through: AtlasCamera(relief: relief, over: plan.extent),
            ).fit
        }

        for (earlier, later) in zip(fits, fits.dropFirst()) {
            #expect(earlier != later, "the framing did not move between two steps of the flip")
        }
    }

    /// Both angles the reader can flip FROM: the one the room opens at, and one they drove it to.
    static let turns: [AtlasOrientation] = [.opening, AtlasOrientation(yaw: 1.4, pitch: 1.0)]

    /// What that refit is FOR: the map fills its extent the whole way through the move rather than
    /// only at the two ends. A fit held from the start would frame every step by a picture only one
    /// of them has, which the control below measures.
    @Test(arguments: turns)
    func `the map fills its extent at every step of the move`(turned: AtlasOrientation) throws {
        let plan = try Self.plan()

        for relief in Self.steps {
            let reach = Self.reach(Self.drawn(plan, at: relief, turned: turned), in: plan.extent)
            // Inside the ground it is drawn into: past 1 is a box clipped away mid-flip.
            #expect(reach <= 1.000_001, "the picture left its extent at relief \(relief)")
            // And touching it.
            #expect(reach > 0.99, "the picture reached only \(reach) of its extent at \(relief)")
        }
    }

    /// The control the claim above is otherwise only a claim against: a framing held from the city
    /// end and reused as the towers sink does not frame the middle of the move. Measured, it
    /// OVERSHOOTS — the picture reaches about a tenth past the extent at the halfway point, so the
    /// reader would watch the edges of the map fall off the stage and come back. Which direction it
    /// misses by is the fit's arithmetic to decide; that it misses is the claim.
    @Test func `a framing held from the city end does not frame the middle of the move`() throws {
        let plan = try Self.plan()
        let city = AtlasCamera.city(over: plan.extent)
        let held = AtlasFit(framing: plan, through: city, into: plan.extent)

        let reach = Self.reach(Self.drawnStale(plan, at: 0.5, through: held), in: plan.extent)
        #expect(reach > 1.05, "the stale framing still framed the map, at \(reach) of its extent")
    }

    /// Why the move has to settle on an EXACT 0 and not merely near it. `isFlat` calls the camera
    /// flat below 0.02 — which is what brings the plate names back — so a near miss draws the names
    /// of the treemap over a picture that is still in relief, and every one of them sits a little
    /// off the box it belongs to.
    @Test func `a near miss reads as the treemap and is not one`() throws {
        let plan = try Self.plan()
        let nearMiss = AtlasCamera(relief: 0.019, over: plan.extent)
        #expect(nearMiss.isFlat, "0.019 is past isFlat's own threshold, so the names are back")

        let settled = Self.drawn(plan, at: 0)
        let missed = Self.drawn(plan, at: 0.019)
        let drift = zip(settled, missed).map { hypot($1.x - $0.x, $1.y - $0.y) }.max() ?? 0
        // A point is the smallest drift worth a word, and this is well past it: the boxes have
        // visibly moved while the map claims to be flat.
        #expect(drift > 1, "a near miss drifted only \(drift)pt, which nothing would see")
    }

    /// And that an exact 0 has no drift at all — the other half of the same claim, so the one above
    /// cannot pass by the fixture having moved under both readings.
    ///
    /// Stated where the reader sees it: the viewport is the plan's own extent, so at relief 0 a box
    /// is drawn at the very points it was TILED at. A corner off by a point here is the treemap
    /// standing subtly in relief.
    @Test func `an exact zero settles on the tiling itself`() throws {
        let plan = try Self.plan()
        let projection = AtlasProjection(
            of: plan,
            through: AtlasCamera(relief: 0, over: plan.extent),
        )

        for tile in plan.tiles {
            // At the ROOF, which is the reading a leftover relief moves and the floor does not.
            let drawn = projection.viewPoint(
                x: tile.rect.minX, y: tile.rect.minY, height: tile.height,
            )
            #expect(abs(drawn.x - tile.rect.minX) < 0.000_001)
            #expect(abs(drawn.y - tile.rect.minY) < 0.000_001)
        }
    }

    /// The other end the move settles on. There is no `isFlat` cliff here — nothing switches on at
    /// 1 the way the plate names switch on at 0 — so what an exact 1 has to be is the city the rest
    /// of the app names by its own constructor. A relief that landed at 1 and drew a camera
    /// `AtlasCamera.city` does not would be two cities one number apart.
    @Test func `an exact one settles on the city the rest of the app names`() throws {
        let plan = try Self.plan()
        #expect(
            AtlasCamera(relief: 1, over: plan.extent) == AtlasCamera.city(over: plan.extent),
        )
    }

    /// The prototype's own rule for the move: the heights collapse and the camera swings overhead
    /// on ONE clock, so the two read as one move rather than two.
    ///
    /// Argued here from the arithmetic rather than from a frame count, because that is where it is
    /// true: `relief` is a single number, and both readings are taken off the camera built from it.
    /// A second parameter for either half is what this would catch.
    @Test func `the heights and the camera move on one clock`() throws {
        let plan = try Self.plan()
        let tile = try #require(plan.tiles.first { $0.height > 0 })

        for relief in [0.25, 0.5, 0.75] {
            let camera = AtlasCamera(relief: relief, over: plan.extent)
            let floor = camera.project(x: tile.rect.minX, y: tile.rect.minY, height: 0)
            let roof = camera.project(x: tile.rect.minX, y: tile.rect.minY, height: tile.height)
            // Still standing: the heights have not finished collapsing.
            #expect(floor != roof, "the height had already collapsed at relief \(relief)")
            // And still overhead: the camera has not finished swinging either. Both readings come
            // off the one camera above, which is the claim.
            #expect(!camera.isFlat, "the camera had already landed at relief \(relief)")
        }
    }
}
