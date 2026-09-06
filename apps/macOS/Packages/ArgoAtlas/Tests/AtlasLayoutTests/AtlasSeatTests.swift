import AtlasFixtures
@testable import AtlasLayout
import CoreGraphics
import Testing

/// One tiling, and a descent that is nothing but the camera (#1490).
///
/// The claim is invisible to a screenshot taken one level at a time: a folder re-tiled into the
/// whole stage and a folder seated in a fixed tiling both fill the frame, and only a number says
/// the rectangles are the same ones. So the rectangles are what this asks about.
@Suite("Atlas — one tiling, and a camera over it")
struct AtlasSeatTests {
    static let ground = CGSize(width: 900, height: 640)

    static func plan() throws -> AtlasPlan {
        try AtlasStandpoint(on: AtlasMapFixture.argo())
            .plan(by: AtlasChannels("lines"), into: ground)
    }

    /// Two folders of the committed measurement, one shallow and one deep, so the claims below are
    /// made about a real repository's nesting rather than about two tidy fixtures.
    static let shallow = "argo/docs"
    static let deep = "argo/apps/macOS/Packages"

    /// **THE claim.** The plan a reader standing at the root is looking at and the plan they are
    /// looking at three levels down are the same rectangles, file for file — which is what leaves
    /// a camera something to move between.
    @Test(arguments: [shallow, deep])
    func `the tiling is the same wherever the reader stands`(folder: String) throws {
        let map = try AtlasMapFixture.argo()
        let channels = AtlasChannels("lines")

        let root = AtlasStandpoint(on: map).plan(by: channels, into: Self.ground)
        let inside = AtlasStandpoint(on: map, standingIn: folder)
            .plan(by: channels, into: Self.ground)

        #expect(root.tiles == inside.tiles)
        #expect(root.plates == inside.plates)
        // And the folder is really in there, so the equality above is not two empty maps agreeing.
        #expect(inside.tiles.contains { $0.path.hasPrefix(folder + "/") })
    }

    /// The words are still of the folder, which is the half of the descent that did NOT move: the
    /// index, the reading and the trail read this Map while the picture reads the whole one.
    @Test func `the reader's scope is still the folder they are in`() throws {
        let map = try AtlasMapFixture.argo()
        let standpoint = AtlasStandpoint(on: map, standingIn: Self.deep)

        #expect(!standpoint.inside.plots.isEmpty)
        #expect(standpoint.inside.plots.count < map.plots.count)
        #expect(standpoint.trail.count == 4)
        #expect(standpoint.here == Self.deep)
    }

    /// A folder the Map no longer carries puts the reader at the top, in both answers at once —
    /// degrade-down, and the same answer `descending(to:)` and `trail(to:)` give.
    @Test func `a folder that went out from under the reader is the whole repository`() throws {
        let map = try AtlasMapFixture.argo()
        let standpoint = AtlasStandpoint(on: map, standingIn: "argo/nothing/stands/here")

        #expect(standpoint.inside.plots.count == map.plots.count)
        #expect(standpoint.trail.count == 1)
    }

    /// The camera seats onto the folder's own plate: the plate fills the stage on one axis and is
    /// centred on the other, which is the design's `seatCam` at `SEAT` of 1.
    @Test(arguments: [shallow, deep])
    func `standing in a folder seats the camera on its plate`(folder: String) throws {
        let plan = try Self.plan()
        let camera = AtlasCamera.flat(over: plan.extent)
        let plate = try #require(plan.plate(standingIn: folder))

        let fit = AtlasFit(
            framing: plan, through: camera, into: plan.extent, standingIn: folder,
        )
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
        let plan = try Self.plan()
        let camera = AtlasCamera.flat(over: plan.extent)

        let top = AtlasProjection(of: plan, through: camera, standingIn: nil)
        let down = AtlasProjection(of: plan, through: camera, standingIn: Self.deep)
        let back = AtlasProjection(of: plan, through: camera, standingIn: nil)

        #expect(down.fit != top.fit)
        #expect(back.fit == top.fit)
    }

    /// **A descent magnifies.** The whole point of the re-tiling that went is that it did NOT: the
    /// reseat wrote the scale straight back, so nine levels of descent gave no magnification at
    /// all. Walked down one trail rather than compared between two, because depth alone says
    /// nothing — a folder three levels down can hold more of the repository than one at the top.
    @Test func `going further down a trail only ever magnifies`() throws {
        let map = try AtlasMapFixture.argo()
        let plan = try Self.plan()
        let camera = AtlasCamera.flat(over: plan.extent)

        let seats = AtlasStandpoint(on: map, standingIn: Self.deep).trail.map { step in
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
        let extent = CGSize(width: 800, height: 600)
        let plan = AtlasPlan(
            extent: extent,
            plates: [
                .init(path: "a", rect: CGRect(origin: .zero, size: extent), depth: 0),
                .init(
                    path: "a/sliver",
                    rect: CGRect(x: 10, y: 10, width: 0.4, height: 0.3),
                    depth: 1,
                ),
            ],
            tiles: [
                .init(
                    path: "a/one",
                    rect: CGRect(x: 0, y: 0, width: 800, height: 600),
                    band: .hot,
                    height: 4,
                ),
            ],
        )
        let camera = AtlasCamera.flat(over: extent)

        let top = AtlasFit(framing: plan, through: camera, into: extent)
        let seated = AtlasFit(
            framing: plan, through: camera, into: extent, standingIn: "a/sliver",
        )

        #expect(seated.scale.x <= top.scale.x * AtlasFit.nearest * 1.000_001)
        #expect(seated.scale.x >= top.scale.x * AtlasFit.nearest * 0.999_999)
    }

    /// A folded run — a folder holding one folder and nothing else — has no plate of its own, and
    /// every folder of it seats on the plate the tiler drew for the run.
    @Test func `every folder of a folded run seats on the run's own plate`() throws {
        let plan = try Self.plan()
        let folded = try #require(plan.plates.first { $0.covers.count > 1 })

        for folder in folded.covers {
            #expect(plan.plate(standingIn: folder)?.rect == folded.rect)
        }
    }

    /// A plate's name follows the picture, because the seat moved the picture out from under the
    /// plan: a name placed in plan points would caption where the folder used to be.
    @Test func `a plate's name band moves with the seat`() throws {
        let plan = try Self.plan()
        let camera = AtlasCamera.flat(over: plan.extent)
        let plate = try #require(plan.plate(standingIn: Self.shallow))

        let top = AtlasProjection(of: plan, through: camera)
        let inside = AtlasProjection(of: plan, through: camera, standingIn: Self.shallow)

        let there = try #require(top.nameBand(of: plate))
        let here = try #require(inside.nameBand(of: plate))
        #expect(here != there)
        // Seated, the folder's own name starts at the left edge of the stage, because the plate it
        // names is what the stage is now framing.
        #expect(here.minX < there.minX)
    }

    /// **At the fit, every name the tiler placed is still drawn.** Read back through the
    /// projection, a strip cut to exactly the header's height lands a rounding bit under it, and
    /// the map loses half its captions to arithmetic nobody can see in a screenshot.
    @Test func `the names at the fit are exactly the ones the tiler cut`() throws {
        let plan = try Self.plan()
        let projection = AtlasProjection(
            of: plan, through: AtlasCamera.flat(over: plan.extent),
        )

        let named = plan.plates.filter { projection.nameBand(of: $0) != nil }

        #expect(named.map(\.path) == plan.plates.filter(\.carriesName).map(\.path))
        #expect(!named.isEmpty)
    }

    /// **The city is not seated.** Its camera is the reader's — they drive its turn and tilt — and
    /// a descent that moved it would take the view away from whoever was looking through it.
    @Test func `the city camera is the reader's, not the descent's`() throws {
        let plan = try Self.plan()
        let city = AtlasCamera.city(over: plan.extent)

        let top = AtlasFit(framing: plan, through: city, into: plan.extent)
        let inside = AtlasFit(
            framing: plan, through: city, into: plan.extent, standingIn: Self.deep,
        )

        #expect(inside == top)
    }
}
