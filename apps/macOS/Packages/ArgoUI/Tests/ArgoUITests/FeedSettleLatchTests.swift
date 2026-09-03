import AppKit
@testable import ArgoSpecimens
@testable import ArgoUI
import Foundation
import Testing

/// The latch a pass sets, and the promise that it is always given back (#1132).
///
/// `settlingFor` is what `isMeasuring` is read off, and `isMeasuring` is what tells the overview
/// lane that the feed's heights are provisional. A lane over a provisional feed does not re-walk —
/// it goes on drawing the reading it last held (ADR-0030, Rule 3). So a latch that is set and never
/// given back is not a leak of a flag: it is a lane that draws one document's miniature over
/// another document's feed, silently, for the rest of the launch.
///
/// The way it happened: `landed` guarded the document and the table on the same line that checked
/// the latch, and returned before clearing it. `table` is `weak` and `KeptDecks` evicts at six, so
/// a deck that went away while its pass was in flight left the latch set with nothing that could
/// ever clear it — the only other writes are the two the coordinator makes when a pass STARTS.
@Suite("Feed settle latch")
@MainActor
struct FeedSettleLatchTests {
    /// A pane the deck's column is the width of.
    private static let pane = CGSize(width: 760, height: 600)

    /// Narrow enough to be under `ArgoFeedRow.column`, so the re-wrap is real and a pass genuinely
    /// starts — above the column the measure does not move and nothing is owed at all
    /// (`FeedRewrapMeasureTests`).
    private static let narrowed = CGSize(width: 420, height: 600)

    /// The deck evicted while its pass was in flight — the case that latched.
    @Test
    func `a pass whose table went away still gives the latch back`() async throws {
        let handle = FeedTableHandle()
        let coordinator = await FeedTableFixture
            .laidOut(FeedProjection.longRows, in: Self.pane, through: handle)
        await FeedTableFixture.settled(coordinator)
        let scroller = try #require(coordinator.scroller)

        scroller.frame = NSRect(origin: .zero, size: Self.narrowed)
        coordinator.settleAfterResize()
        #expect(coordinator.isMeasuring, "the re-wrap must actually start a pass")

        // The deck goes away under the pass. `table` is weak, so this is what eviction looks like
        // from in here.
        coordinator.table = nil
        await coordinator.measured()

        #expect(coordinator.isMeasuring == false)
        #expect(coordinator.settlingFor == nil)
    }

    /// And the ordinary landing still clears it — the guard above must not have been bought by
    /// giving the latch back before the pass is really over.
    @Test
    func `a pass that landed gives the latch back`() async {
        let handle = FeedTableHandle()
        let coordinator = await FeedTableFixture
            .laidOut(FeedProjection.longRows, in: Self.pane, through: handle)
        await FeedTableFixture.settled(coordinator)

        #expect(coordinator.isMeasuring == false)
        #expect(coordinator.settlingFor == nil)
        #expect(coordinator.geometry.isSettled)
    }
}
