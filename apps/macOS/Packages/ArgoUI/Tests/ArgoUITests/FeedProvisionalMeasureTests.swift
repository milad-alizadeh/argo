import AppKit
@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// The lane and the settle answer the same question the same way (#1132).
///
/// `FeedMeasureStamp.rewraps` decides whether a pass is owed, and `readingStamp().isProvisional`
/// decides whether the lane may draw. Both are about the width — so both have to mean the same
/// thing BY the width, and since #1132 that thing is the MEASURE.
///
/// Asked as the raw width on one side and the measure on the other, a resize between two widths
/// that both sit at or above `ArgoFeedRow.column` is a document that is settled and a lane that is
/// provisional, for ever: the settle correctly answers "nothing owed, the rows wrap the same", so
/// the stamp keeps the width it was measured at, while the lane compares that against a table that
/// has moved. Nothing re-settles it, so nothing ever clears it — and a permanently provisional lane
/// never re-walks. It holds the reading it last drew and re-arms its layout every turn of the run
/// loop waiting for a settle that already happened.
@Suite("Feed provisional measure")
@MainActor
struct FeedProvisionalMeasureTests {
    /// Both above `ArgoFeedRow.column`, so the rows wrap identically at either and no pass is owed.
    private static let pane = CGSize(width: 1023, height: 600)
    private static let narrowed = CGSize(width: 766, height: 600)

    /// Below the column, where the measure really does move.
    private static let cramped = CGSize(width: 420, height: 600)

    @Test
    func `a resize that changed no wrap leaves the lane unprovisional`() async throws {
        let handle = FeedTableHandle()
        let coordinator = await FeedTableFixture
            .laidOut(FeedProjection.longRows, in: Self.pane, through: handle)
        await FeedTableFixture.settled(coordinator)
        let scroller = try #require(coordinator.scroller)
        #expect(try #require(coordinator.readingStamp()).isProvisional == false)

        scroller.frame = NSRect(origin: .zero, size: Self.narrowed)
        coordinator.settleAfterResize()
        await FeedTableFixture.settled(coordinator)

        #expect(try #require(coordinator.readingStamp()).isProvisional == false)
        #expect(coordinator.reading() != nil)
    }

    /// The control: a resize that DID move the measure is provisional until its pass lands, and
    /// unprovisional after. Without this the case above could be bought by never being provisional.
    @Test
    func `a resize that changed the wrap settles unprovisional too`() async throws {
        let handle = FeedTableHandle()
        let coordinator = await FeedTableFixture
            .laidOut(FeedProjection.longRows, in: Self.pane, through: handle)
        await FeedTableFixture.settled(coordinator)
        let scroller = try #require(coordinator.scroller)

        scroller.frame = NSRect(origin: .zero, size: Self.cramped)
        coordinator.settleAfterResize()
        await FeedTableFixture.settled(coordinator)

        #expect(try #require(coordinator.readingStamp()).isProvisional == false)
        #expect(coordinator.reading() != nil)
    }
}
