@testable import AtlasLayout
import CoreGraphics
import Testing

/// Where a folder's name is drawn, once the camera can be somewhere other than the fit (#1490).
///
/// A name is laid out on the ground and the seat moves the ground under it, so every one of these
/// is a caption landing on the plate it names rather than on the one that used to be there.
@Suite("Atlas — a plate's name follows its plate")
struct AtlasPlateNameTests {
    /// A plate's name follows the picture: placed in plan points it would caption where the folder
    /// used to be.
    @Test func `a plate's name band moves with the seat`() throws {
        let plan = try AtlasSeatFixture.plan()
        let camera = AtlasCamera.flat(over: plan.extent)
        let plate = try #require(plan.plate(standingIn: AtlasSeatFixture.shallow))

        let top = AtlasProjection(of: plan, through: camera)
        let inside = AtlasProjection(
            of: plan, through: camera, standingIn: AtlasSeatFixture.shallow,
        )

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
        let plan = try AtlasSeatFixture.plan()
        let projection = AtlasProjection(of: plan, through: AtlasCamera.flat(over: plan.extent))

        let named = plan.plates.filter { projection.nameBand(of: $0) != nil }

        #expect(named.map(\.path) == plan.plates.filter(\.carriesName).map(\.path))
        #expect(!named.isEmpty)
    }

    /// A name nothing can see is not laid out. A seat magnifies by up to ninety, and at that zoom
    /// nearly every plate in the plan clears the header — hundreds of captions built once a frame
    /// for a stage that shows a handful.
    @Test func `a plate off the stage has no name band`() throws {
        let plan = try AtlasSeatFixture.plan()
        let camera = AtlasCamera.flat(over: plan.extent)

        let top = AtlasProjection(of: plan, through: camera)
        let inside = AtlasProjection(
            of: plan, through: camera, standingIn: AtlasSeatFixture.shallow,
        )

        let banded = plan.plates.filter { inside.nameBand(of: $0) != nil }
        #expect(banded.count < plan.plates.filter { top.nameBand(of: $0) != nil }.count)
        #expect(banded.contains { $0.covers.contains(AtlasSeatFixture.shallow) })
    }
}
