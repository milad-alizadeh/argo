@testable import ArgoUI
import Testing

/// Where the reading lands and what is re-measured to put it there — one test per row of the
/// decision table the policy is the spec of (#664).
///
/// Every claim here used to be reachable only by an XCUITest that seized the machine's keyboard and
/// mouse and never ran on CI, which is why a wrong landing could ship.
@Suite("Feed scroll policy")
struct FeedScrollPolicyTests {
    private static let anchor = FeedAnchor(row: 2, into: 12)

    @Test
    func `a row arriving while the reader is following carries them to the end`() {
        var policy = FeedScrollFixture.showing()
        let arriving = FeedScrollFixture.oneMoreRow()
        let decision = policy.resolve(
            .rowsChanged(from: FeedScrollFixture.reading, to: arriving),
        )
        #expect(decision.landing == .end)
        #expect(decision.remeasure == .none)
        #expect(decision.delta == .append(
            arrived: arriving.count - 1 ..< arriving.count,
            rewritten: arriving.count - 2,
        ))
    }

    @Test
    func `a row arriving while the reader has scrolled up leaves the reading where it is`() {
        var policy = FeedScrollFixture.showing()
        _ = FeedScrollFixture.scrolledAway(&policy)
        let decision = policy.resolve(
            .rowsChanged(from: FeedScrollFixture.reading, to: FeedScrollFixture.oneMoreRow()),
        )
        #expect(decision.landing == .stay)
        #expect(decision.remeasure == .none)
    }

    @Test
    func `a reading replaced rather than extended re-measures every row and its cells`() {
        var policy = FeedScrollFixture.showing()
        let decision = policy.resolve(
            .rowsChanged(from: FeedScrollFixture.reading, to: [FeedScrollFixture.reading[1]]),
        )
        #expect(decision.remeasure == .rebuild)
        #expect(decision.delta == .reload)
    }

    @Test
    func `a reading that opens held lands on the row it was opened at`() {
        var policy = FeedScrollFixture.showing(held: 3)
        #expect(policy.resolve(.readingOpened(held: 3)).landing == .row(3, into: 0))
    }

    @Test
    func `a reading that opens on nothing in particular lands at its newest line`() {
        var policy = FeedScrollFixture.showing()
        #expect(policy.resolve(.readingOpened(held: nil)).landing == .end)
    }

    @Test
    func `an opening the reader has already scrolled out of stops re-aiming itself`() {
        var policy = FeedScrollFixture.showing()
        _ = FeedScrollFixture.scrolledAway(&policy)
        #expect(policy.resolve(.readingOpened(held: nil)) == .stay)
    }

    @Test
    func `a scroll the reader made moves nothing by itself`() {
        var policy = FeedScrollFixture.showing()
        #expect(FeedScrollFixture.scrolledAway(&policy) == .stay)
    }

    @Test
    func `the first real width rebuilds the rows that were measured against no width`() {
        var policy = FeedScrollFixture.showing()
        let decision = policy.resolve(.paneChanged(width: 600, height: 400, anchor: nil))
        #expect(decision.landing == .end)
        #expect(decision.remeasure == .rebuild)
        #expect(decision.settle == .none)
    }

    @Test
    func `a later width holds the reader's own row and asks to settle when the drag stops`() {
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
    func `the seam letting go re-measures every row and holds the reader's own row`() {
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

    @Test
    func `the way-back control lands at the newest line`() {
        var policy = FeedScrollFixture.laidOut()
        _ = FeedScrollFixture.scrolledAway(&policy)
        #expect(policy.resolve(.followRequested) == FeedScrollDecision(landing: .end))
    }

    @Test
    func `a re-wrap with no row to hold onto falls back to the newest line`() {
        var policy = FeedScrollFixture.laidOut()
        _ = FeedScrollFixture.scrolledAway(&policy)
        #expect(policy.resolve(.resizeEnded(anchor: nil)).landing == .end)
    }
}
