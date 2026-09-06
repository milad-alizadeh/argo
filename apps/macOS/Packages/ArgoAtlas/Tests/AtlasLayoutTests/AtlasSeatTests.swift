@testable import AtlasLayout
import CoreGraphics
import Testing

/// The camera over the one tiling: where a descent puts it, and the bounds it may not leave
/// (#1490).
///
/// `AtlasStandpointTests` holds the other half — that the tiling itself does not move — and the
/// two together are what makes a descent something #1423 can fly rather than a cut between two
/// pictures with nothing in common.
@Suite("Atlas — the camera a descent moves")
struct AtlasSeatTests {
    /// The camera seats onto the folder's own plate: the plate fills the stage on one axis and is
    /// centred on the other, which is the design's `seatCam` at `SEAT` of 1.
    @Test(arguments: [AtlasSeatFixture.shallow, AtlasSeatFixture.deep])
    func `standing in a folder seats the camera on its plate`(folder: String) throws {
        let plan = try AtlasSeatFixture.plan()
        let camera = AtlasCamera.flat(over: plan.extent)
        let plate = try #require(plan.plate(standingIn: folder))

        let fit = AtlasFit(framing: plan, through: camera, into: plan.extent, standingIn: folder)
        let corners = [
            CGPoint(x: plate.rect.minX, y: plate.rect.minY),
            CGPoint(x: plate.rect.maxX, y: plate.rect.maxY),
        ].map { fit.clip(camera.project(x: $0.x, y: $0.y, height: 0)) }

        // Inside the stage on both axes, and touching it on one: the whole of the folder on screen
        // and nothing of its siblings.
        #expect(corners.allSatisfy { abs($0.x) <= 1.000_001 && abs($0.y) <= 1.000_001 })
        #expect(corners.contains { abs($0.x) > 0.999_999 || abs($0.y) > 0.999_999 })
        // Centred: the two corners are equal and opposite about the middle of the stage.
        #expect(abs(corners[0].x + corners[1].x) < 0.000_001)
        #expect(abs(corners[0].y + corners[1].y) < 0.000_001)
    }

    /// Going down one level and back up lands on the camera it started at, exactly. The seat is a
    /// function of where the reader stands and nothing else, so there is no drift to accumulate —
    /// which is the property #1423's flight will retarget against.
    @Test func `going down a level and up again is the camera it started at`() throws {
        let plan = try AtlasSeatFixture.plan()
        let camera = AtlasCamera.flat(over: plan.extent)

        let top = AtlasProjection(of: plan, through: camera, standingIn: nil)
        let down = AtlasProjection(of: plan, through: camera, standingIn: AtlasSeatFixture.deep)
        let back = AtlasProjection(of: plan, through: camera, standingIn: nil)

        #expect(down.fit != top.fit)
        #expect(back.fit == top.fit)
    }

    /// **A descent magnifies.** The whole point of the re-tiling that went is that it did NOT: the
    /// reseat wrote the scale straight back, so nine levels of descent gave no magnification at
    /// all. Walked down one trail rather than compared between two, because depth alone says
    /// nothing — a folder three levels down can hold more of the repository than one at the top.
    @Test func `going further down a trail only ever magnifies`() throws {
        let map = try AtlasSeatFixture.map()
        let plan = try AtlasSeatFixture.plan()
        let camera = AtlasCamera.flat(over: plan.extent)

        let seats = AtlasStandpoint(on: map, standingIn: AtlasSeatFixture.deep).trail.map { step in
            AtlasFit(
                framing: plan, through: camera, into: plan.extent, standingIn: step.path,
            ).scale.x
        }

        #expect(seats.count == 4)
        #expect(zip(seats, seats.dropFirst()).allSatisfy { $1 >= $0 })
        let top = try #require(seats.first)
        let bottom = try #require(seats.last)
        #expect(bottom > top)
    }

    /// The bound, asked of a plate small enough to want more magnification than the design allows:
    /// a sliver a thousandth of the plan across would seat at hundreds of times the fit.
    @Test func `the seat is bounded off the zoom that frames the whole plan`() {
        let plan = Self.plan(under: CGRect(x: 10, y: 10, width: 0.4, height: 0.3))
        let camera = AtlasCamera.flat(over: plan.extent)

        let top = AtlasFit(framing: plan, through: camera, into: plan.extent)
        let seated = AtlasFit(
            framing: plan, through: camera, into: plan.extent, standingIn: "a/small",
        )

        #expect(seated.scale.x <= top.scale.x * AtlasFit.nearest * 1.000_001)
        #expect(seated.scale.x >= top.scale.x * AtlasFit.nearest * 0.999_999)
    }

    /// A plate with no ground under it is no seat. The clamp would otherwise frame a point at half
    /// the fit — a worse answer than the one a folder no plate stands under already gets.
    @Test func `a plate with no area is framed as the whole plan`() {
        let plan = Self.plan(under: CGRect(x: 40, y: 40, width: 0, height: 0))
        let camera = AtlasCamera.flat(over: plan.extent)

        let top = AtlasFit(framing: plan, through: camera, into: plan.extent)
        let seated = AtlasFit(
            framing: plan, through: camera, into: plan.extent, standingIn: "a/small",
        )

        #expect(seated == top)
    }

    /// **The seat lands with the turn, it does not arrive early.** `isFlat` is a threshold, and a
    /// camera one part in fifty short of the plan would take a jump of up to ninety times the fit
    /// there — 98% of the way through the turn between the two views.
    @Test(arguments: [0.5, 0.1, 0.019])
    func `a camera part way to the plan frames the whole plan`(relief: Double) throws {
        let plan = try AtlasSeatFixture.plan()
        let turning = AtlasCamera(relief: relief, over: plan.extent)

        let top = AtlasFit(framing: plan, through: turning, into: plan.extent)
        let inside = AtlasFit(
            framing: plan, through: turning, into: plan.extent,
            standingIn: AtlasSeatFixture.deep,
        )

        #expect(inside == top)
    }

    /// **The city is not seated.** Its camera is the reader's — they drive its turn and tilt — and
    /// a descent that moved it would take the view away from whoever was looking through it.
    @Test func `the city camera is the reader's, not the descent's`() throws {
        let plan = try AtlasSeatFixture.plan()
        let city = AtlasCamera.city(over: plan.extent)

        let top = AtlasFit(framing: plan, through: city, into: plan.extent)
        let inside = AtlasFit(
            framing: plan, through: city, into: plan.extent, standingIn: AtlasSeatFixture.deep,
        )

        #expect(inside == top)
    }

    /// A plan holding one plate of a given shape, for the two claims about the bound. Built rather
    /// than measured: a repository with a plate a thousandth of the plan across is not something a
    /// fixture can be relied on to hold, and the bound has to be asked about anyway.
    private static func plan(under rect: CGRect) -> AtlasPlan {
        let extent = CGSize(width: 800, height: 600)
        return AtlasPlan(
            extent: extent,
            plates: [
                .init(path: "a", rect: CGRect(origin: .zero, size: extent), depth: 0),
                .init(path: "a/small", rect: rect, depth: 1),
            ],
            tiles: [
                .init(
                    path: "a/one",
                    rect: CGRect(origin: .zero, size: extent),
                    band: .hot,
                    height: 4,
                ),
            ],
        )
    }
}
