@testable import ArgoUI
import Testing

/// Whether the reading is following the Session, and the row the new-message count is taken from.
///
/// Following is asserted through what the NEXT arriving row does, because that is the fact a reader
/// sees. The transitions here are the ones that have bitten before (#473, #476, #477).
@Suite("Feed scroll following")
struct FeedScrollFollowingTests {
    /// Where the next row said would land — the observable form of "is it still following".
    private static func landingOfNextRow(_ policy: inout FeedScrollPolicy) -> FeedLanding {
        policy.resolve(
            .rowsChanged(from: FeedScrollFixture.reading, to: FeedScrollFixture.oneMoreRow()),
        ).landing
    }

    @Test
    func `a reader who scrolls back to the end is carried by the next line again`() {
        var policy = FeedScrollFixture.showing()
        _ = FeedScrollFixture.scrolledAway(&policy)
        _ = FeedScrollFixture.scrolledToEnd(&policy)
        #expect(Self.landingOfNextRow(&policy) == .end)
    }

    @Test
    func `a reader who leaves the end counts from the last line said before they left`() {
        var policy = FeedScrollFixture.showing()
        _ = FeedScrollFixture.scrolledAway(&policy)
        #expect(policy.leftAt == FeedScrollFixture.reading.last?.id)
    }

    @Test
    func `a reader who arrives back at the end has nothing left to count`() {
        var policy = FeedScrollFixture.showing()
        _ = FeedScrollFixture.scrolledAway(&policy)
        _ = FeedScrollFixture.scrolledToEnd(&policy)
        #expect(policy.leftAt == nil)
    }

    @Test
    func `lines arriving while the reader is away do not move what the count is taken from`() {
        var policy = FeedScrollFixture.showing()
        _ = FeedScrollFixture.scrolledAway(&policy)
        _ = Self.landingOfNextRow(&policy)
        #expect(policy.leftAt == FeedScrollFixture.reading.last?.id)
    }

    @Test
    func `a reading opened held is detached before a reader has touched anything`() {
        var policy = FeedScrollFixture.showing(held: 3)
        #expect(Self.landingOfNextRow(&policy) == .stay)
    }

    @Test
    func `a reading opened held counts from the row it was opened at`() {
        let policy = FeedScrollFixture.showing(held: 3)
        #expect(policy.leftAt == 3)
    }

    @Test
    func `the way-back control starts the reader being carried again`() {
        var policy = FeedScrollFixture.showing()
        _ = FeedScrollFixture.scrolledAway(&policy)
        _ = policy.resolve(.followRequested)
        #expect(Self.landingOfNextRow(&policy) == .end)
    }

    @Test
    func `the way-back control leaves nothing for the count to read`() {
        var policy = FeedScrollFixture.showing()
        _ = FeedScrollFixture.scrolledAway(&policy)
        _ = policy.resolve(.followRequested)
        #expect(policy.leftAt == nil)
    }

    @Test
    func `a reading that empties owes its opening scroll again`() {
        var policy = FeedScrollFixture.showing()
        _ = policy.resolve(.readingOpened(held: nil))
        #expect(!policy.isOpeningOwed)
        _ = policy.resolve(.rowsChanged(from: FeedScrollFixture.reading, to: []))
        _ = policy.resolve(.rowsChanged(from: [], to: FeedScrollFixture.reading))
        #expect(policy.isOpeningOwed)
    }

    @Test
    func `a reader's scroll during an opening retires the passes still to come`() {
        var policy = FeedScrollFixture.showing(held: 3)
        _ = policy.resolve(.readingOpened(held: 3))
        _ = FeedScrollFixture.scrolledAway(&policy)
        #expect(policy.resolve(.readingOpened(held: 3)) == .stay)
    }
}
