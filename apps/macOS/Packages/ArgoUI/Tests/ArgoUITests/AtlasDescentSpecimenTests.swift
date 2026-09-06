@testable import ArgoSpecimens
import AtlasFixtures
import AtlasLayout
import Testing

/// The two frames of #1156 are of a reader INSIDE a folder, and a path the measurement no longer
/// carries would render the whole repository instead — the state before the one the frame is for,
/// with nothing in the picture to say so.
///
/// Asserted against the same committed fixture the specimens draw, so a fixture regenerated from a
/// repository that moved its folders fails here rather than in a screenshot nobody re-reads.
@Suite("Atlas — the descent specimens stand somewhere")
struct AtlasDescentSpecimenTests {
    @Test(arguments: [AtlasDescentPaths.deep, AtlasDescentPaths.shallow])
    func `each specimen enters a folder the fixture measured`(path: String) throws {
        let map = try AtlasMapFixture.argo()

        let inside = try #require(map.descending(to: path), "\(path) is no folder of the fixture")

        #expect(!inside.plots.isEmpty)
        // Narrower than the whole map, which is the fact the frame is FOR: a folder holding every
        // file the repository has would draw the picture the reader was already looking at.
        #expect(inside.plots.count < map.plots.count)
    }

    /// The trail is what the frames are judged on, and the two were picked to be different shapes:
    /// one crumb in front of where you are, and three.
    @Test func `the two frames stand at different depths`() throws {
        let map = try AtlasMapFixture.argo()

        #expect(map.trail(to: AtlasDescentPaths.shallow).count == 2)
        #expect(map.trail(to: AtlasDescentPaths.deep).count == 4)
    }
}
