@testable import ArgoSpecimens
@testable import ArgoUI
import Foundation
import Testing

/// Where the reading lands when the CONTENT changes under the reader — one test per row of the
/// decision table the policy is the spec of (#664): a row arriving, a reading replaced whole, a
/// reading opening, the reader's own scroll, and the way-back control.
///
/// The table splits by the event that reaches the policy; the pane's own events are
/// `FeedScrollPaneTests`.
@Suite("Feed scroll policy")
struct FeedScrollPolicyTests {
    @Test
    func `a row arriving while the reader is following carries them to the end`() throws {
        var policy = FeedScrollFixture.showing()
        let arriving = FeedScrollFixture.oneMoreRow()
        let decision = policy.resolve(
            .rowsChanged(from: FeedScrollFixture.reading, to: arriving),
        )
        #expect(decision.landing == .end)
        #expect(decision.remeasure == .none)
        // The arriving row is a message, so it also takes the chip off the message that had it.
        let hadChip = try #require(FeedScrollFixture.reading.lastIndex { $0.kind.isMessage })
        #expect(decision.delta == .append(
            arrived: arriving.count - 1 ..< arriving.count,
            rewritten: IndexSet([arriving.count - 2, hadChip]),
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
    func `the way-back control lands at the newest line`() {
        var policy = FeedScrollFixture.laidOut()
        _ = FeedScrollFixture.scrolledAway(&policy)
        #expect(policy.resolve(.followRequested) == FeedScrollDecision(landing: .end))
    }

    @Test
    func `a reading replaced while the reader has scrolled up leaves them where they are`() {
        var policy = FeedScrollFixture.showing()
        _ = FeedScrollFixture.scrolledAway(&policy)
        let decision = policy.resolve(
            .rowsChanged(from: FeedScrollFixture.reading, to: [FeedScrollFixture.reading[1]]),
        )
        #expect(decision.landing == .stay)
        #expect(decision.remeasure == .rebuild)
    }
}
