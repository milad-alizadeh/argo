@testable import ArgoSpecimens
import AtlasFixtures
import AtlasLayout
import Testing

/// The two frames of #1158 are of a map re-tiled by inferred domain, and a fixture that inferred
/// nothing would render the folder map instead — the state before the one the frames are for, with
/// nothing in the picture to say so.
///
/// Asserted against the same committed fixture the specimens draw, so a fixture regenerated without
/// its inference, or one whose clusterer named its regions differently, fails here rather than in a
/// screenshot nobody re-reads.
@Suite("Atlas — the domain specimens have a partition to draw")
struct AtlasDomainsSpecimenTests {
    @Test func `the committed measurement carries an inference to re-tile on`() throws {
        let map = try AtlasMapFixture.argo()

        #expect(map.canRegroup)
        // The two facts the frames are FOR: more than one region, so the wheel has neighbours to
        // stay clear of, and files in none, so the unassigned grey is on screen beside them.
        #expect((map.inference?.domains.count ?? 0) > 1)
        #expect(!map.unassigned.isEmpty)
    }

    @Test func `the second frame stands inside a region the fixture really holds`() throws {
        let map = try AtlasMapFixture.argo()
        let regrouped = try #require(map.regrouped())

        let inside = try #require(
            regrouped.descending(to: AtlasDomainPaths.region),
            "\(AtlasDomainPaths.region) is no region of the fixture's inference",
        )

        #expect(!inside.plots.isEmpty)
        // Narrower than the whole map, which is the fact the frame is for: a region holding every
        // file would draw the picture the reader was already looking at.
        #expect(inside.plots.count < regrouped.plots.count)
        // And the trail says which region — the root, then where they are.
        #expect(regrouped.trail(to: AtlasDomainPaths.region).count == 2)
    }
}
