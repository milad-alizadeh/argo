@testable import ArgoUI
import Foundation
import Testing

/// Where the reading lands when the PANE changes under it — one test per row of the decision table
/// the policy is the spec of (#664): the first real width, a later one, a height alone, the resize
/// seam letting go, the settle behind it, and each batch of the re-measure that follows.
///
/// The reading's own events are `FeedScrollPolicyTests`. Every case here also states what is
/// RE-MEASURED, because a landing held without one puts the reader on a row of the wrong height.
@Suite("Feed scroll pane")
struct FeedScrollPaneTests {
    private static let anchor = FeedAnchor(row: 2, into: 12)

    @Test
    func `the first real width rebuilds the rows that were measured against no width`() {
        var policy = FeedScrollFixture.showing()
        let decision = policy.resolve(.paneChanged(width: 600, height: 400, anchor: nil))
        #expect(decision.landing == .end)
        #expect(decision.remeasure == .rebuild)
        #expect(decision.settle == .none)
    }

    @Test
    func `a later width holds the row the reader is on, squaring up only what is on screen`() {
        var policy = FeedScrollFixture.laidOut()
        _ = FeedScrollFixture.scrolledAway(&policy)
        let decision = policy.resolve(.paneChanged(width: 700, height: 400, anchor: Self.anchor))
        #expect(decision.landing == .row(2, into: 12))
        #expect(decision.remeasure == .visible)
        #expect(decision.settle == .whenQuiet)
    }

    @Test
    func `a later width under a following reading keeps it at the end as the end moves`() {
        var policy = FeedScrollFixture.laidOut()
        let decision = policy.resolve(.paneChanged(width: 700, height: 400, anchor: Self.anchor))
        #expect(decision.landing == .end)
        #expect(decision.remeasure == .visible)
    }

    @Test
    func `a height change alone does not detach a following reading`() {
        var policy = FeedScrollFixture.laidOut()
        let decision = policy.resolve(.paneChanged(width: 600, height: 900, anchor: nil))
        #expect(decision.landing == .end)
        #expect(decision.remeasure == .none)
    }

    @Test
    func `the seam letting go squares up every off-screen row that rode the drag`() {
        var policy = FeedScrollFixture.laidOut()
        _ = FeedScrollFixture.scrolledAway(&policy)
        let decision = policy.resolve(.resizeEnded(anchor: Self.anchor))
        #expect(decision.landing == .row(2, into: 12))
        #expect(decision.remeasure == .all)
        #expect(decision.settle == .none)
    }

    @Test
    func `the seam letting go under a following reading leaves it at the end`() {
        var policy = FeedScrollFixture.laidOut()
        #expect(policy.resolve(.resizeEnded(anchor: Self.anchor)).landing == .end)
    }

    @Test
    func `a settle that arrives mid-drag defers again rather than freezing under the hand`() {
        var policy = FeedScrollFixture.laidOut()
        let decision = policy.resolve(.settleElapsed(stillLive: true, anchor: Self.anchor))
        #expect(decision.landing == .stay)
        #expect(decision.remeasure == .none)
        #expect(decision.settle == .whenQuiet)
    }

    @Test
    func `a settle that arrives once the drag is quiet squares up every off-screen row`() {
        var policy = FeedScrollFixture.laidOut()
        _ = FeedScrollFixture.scrolledAway(&policy)
        let decision = policy.resolve(.settleElapsed(stillLive: false, anchor: Self.anchor))
        #expect(decision.landing == .row(2, into: 12))
        #expect(decision.remeasure == .all)
        #expect(decision.settle == .none)
    }

    /// The full re-measure lands in batches now (#856), and the rows ABOVE the reader change
    /// height as they are measured — which slides the reading out from under them unless every
    /// batch puts it back.
    @Test
    func `a measured batch puts a detached reading back on the row it was on`() {
        var policy = FeedScrollFixture.laidOut()
        _ = FeedScrollFixture.scrolledAway(&policy)
        let decision = policy.resolve(.rowsMeasured(anchor: Self.anchor))
        #expect(decision.landing == .row(2, into: 12))
        #expect(decision.remeasure == .none)
        #expect(decision.settle == .none)
    }

    @Test
    func `a measured batch keeps a following reading at the end it grew`() {
        var policy = FeedScrollFixture.laidOut()
        #expect(policy.resolve(.rowsMeasured(anchor: Self.anchor)).landing == .end)
    }

    @Test
    func `a re-wrap with no row to hold onto leaves a detached reader where they are`() {
        var policy = FeedScrollFixture.laidOut()
        _ = FeedScrollFixture.scrolledAway(&policy)
        #expect(policy.resolve(.resizeEnded(anchor: nil)).landing == .stay)
    }

    @Test
    func `a height change while the reader has scrolled up moves nothing`() {
        var policy = FeedScrollFixture.laidOut()
        _ = FeedScrollFixture.scrolledAway(&policy)
        let decision = policy.resolve(.paneChanged(width: 600, height: 900, anchor: nil))
        #expect(decision.landing == .stay)
        #expect(decision.remeasure == .none)
    }
}
