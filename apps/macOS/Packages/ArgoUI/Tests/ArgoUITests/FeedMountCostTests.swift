import AppKit
@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// What opening a reading COSTS, counted in layout passes rather than in seconds.
///
/// One layout pass over the table realises and sizes every cell on screen — a screenful of SwiftUI,
/// ~19 rows and ~24 ms over the 301-row reading on a debug build. So a pass is the unit a mount is
/// honestly measured in, and a pass spent at an offset the reader is about to be moved away from is
/// pure waste (ADR-0028 Rule 1: work scoped to what changed).
///
/// A reading opens at its END. Landing there used to force a full layout first, to read the
/// document height off the laid-out reading — so the top screen was built and sized, then scrolled
/// away and the end screen built and sized behind it. Two passes for one screen: 50 ms of a room
/// switch, of which 22 ms drew nothing anybody saw. `scrollToEnd` reads the same two geometries off
/// `tile()` now, which updates frames and realises no cells.
@Suite("Feed mount cost")
@MainActor
struct FeedMountCostTests {
    private static let column = CGSize(width: 620, height: 800)

    /// A room switch: the deck is destroyed and rebuilt, so the coordinator is new and the measured
    /// heights are the ones the shell kept. Nothing is re-measured, and the question is only what
    /// the mount lays out.
    /// Built, measured, landed and laid out ONCE — which is the mount this suite counts. The
    /// shared fixture lays out either side of the measure so that a suite driving a resize sees the
    /// width move; here that would be two passes by construction and there would be nothing left
    /// to claim.
    private static func remounted(over geometry: FeedGeometry) async -> FeedTableCoordinator {
        let coordinator = FeedTableFixture.mounting(
            FeedProjection.longRows,
            in: column,
            keeping: FeedTableFixture.Kept(handle: FeedTableHandle(), geometry: geometry),
        )
        await coordinator.measured()
        // The opening scroll is claimed on the turn the document lands and landed on the next —
        // see `FeedTableCoordinator.place()`.
        try? await Task.sleep(for: .milliseconds(4))
        return coordinator
    }

    @Test
    func `a reading that opens at its end is laid out once`() async throws {
        let geometry = FeedGeometry()
        // The first mount measures every row; the claim is about coming back to one already
        // measured, which is what a reader moving between rooms does.
        _ = await Self.remounted(over: geometry)
        let coordinator = await Self.remounted(over: geometry)
        let table = try #require(coordinator.table as? FeedTableView)

        // Not one pass spent at the offset the landing was about to leave.
        #expect(table.layouts == 1)
        // And the mount really did open the reading at its end, rather than lay nothing out.
        #expect(coordinator.measurements == 0)
        #expect(coordinator.exposures > 0)
        let offset = try #require(coordinator.offset())
        #expect(offset > table.frame.height / 2)
    }
}
