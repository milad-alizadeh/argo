@testable import AtlasLayout
import CoreGraphics
import Testing

/// One tiling, laid out from the repository's root and never rebuilt (#1490).
///
/// The claim is invisible to a screenshot taken one level at a time: a folder re-tiled into the
/// whole stage and a folder seated in a fixed tiling both fill the frame, and only a number says
/// the rectangles are the same ones. So the rectangles are what this asks about.
@Suite("Atlas — one tiling, wherever the reader stands")
struct AtlasStandpointTests {
    /// **THE claim.** The plan a reader standing at the root is looking at and the plan they are
    /// looking at three levels down are the same rectangles, file for file — which is what leaves
    /// a camera something to move between.
    @Test(arguments: [AtlasSeatFixture.shallow, AtlasSeatFixture.deep])
    func `the tiling is the same wherever the reader stands`(folder: String) throws {
        let map = try AtlasSeatFixture.map()
        let channels = AtlasChannels("lines")
        let ground = AtlasSeatFixture.ground

        let root = AtlasStandpoint(on: map).plan(by: channels, into: ground)
        let inside = AtlasStandpoint(on: map, standingIn: folder).plan(by: channels, into: ground)

        #expect(root.tiles == inside.tiles)
        #expect(root.plates == inside.plates)
        // And the folder is really in there, so the equality above is not two empty maps agreeing.
        #expect(inside.tiles.contains { $0.path.hasPrefix(folder + "/") })
    }

    /// The words are still of the folder, which is the half of the descent that did NOT move: the
    /// index, the reading and the trail read this Map while the picture reads the whole one.
    @Test func `the reader's scope is still the folder they are in`() throws {
        let map = try AtlasSeatFixture.map()
        let standpoint = AtlasStandpoint(on: map, standingIn: AtlasSeatFixture.deep)

        #expect(!standpoint.inside.plots.isEmpty)
        #expect(standpoint.inside.plots.count < map.plots.count)
        #expect(standpoint.trail.count == 4)
        #expect(standpoint.here == AtlasSeatFixture.deep)
    }

    /// A folder the Map no longer carries puts the reader at the top, in both answers at once —
    /// degrade-down, and the same answer `descending(to:)` and `trail(to:)` give.
    @Test func `a folder that went out from under the reader is the whole repository`() throws {
        let map = try AtlasSeatFixture.map()
        let standpoint = AtlasStandpoint(on: map, standingIn: "argo/nothing/stands/here")

        #expect(standpoint.inside.plots.count == map.plots.count)
        #expect(standpoint.trail.count == 1)
    }

    /// A folded run — a folder holding one folder and nothing else — has no plate of its own, and
    /// every folder of it is found on the plate the tiler drew for the run.
    @Test func `every folder of a folded run finds the run's own plate`() throws {
        let plan = try AtlasSeatFixture.plan()
        let folded = try #require(plan.plates.first { $0.covers.count > 1 })

        for folder in folded.covers {
            #expect(plan.plate(standingIn: folder)?.rect == folded.rect)
        }
    }
}
