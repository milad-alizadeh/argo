@testable import ArgoUI
import Testing

/// The end of the `starting` wait, in the feed (#1245).
///
/// The state used to have none: an empty reading under `starting the agent` was everything a spawn
/// that came up quiet ever showed, for the life of the window. Its own suite rather than a case in
/// `FeedWorkingTests`, because what it draws is the row that REPLACES the one that suite is about.
@Suite("Feed startup wait")
@MainActor
struct FeedStartupWaitTests {
    /// It takes the starting row's place and its whole reading with it: a spawn Argo heard nothing
    /// from has written no record for anything to sit above.
    @Test
    func `a wait that ran out is the whole reading`() {
        #expect(FeedProjection.rows(from: [], startedQuietly: true).map(\.content)
            == [.mark(.startedQuietly)])
    }

    /// Both facts, because either alone is the wrong news — see `FeedWorking.quietWords`.
    @Test
    func `the row says the agent started and that it printed nothing`() {
        #expect(FeedMark.startedQuietly.words == "the agent started and printed nothing")
        #expect(FeedMark.startedQuietly.spoken == "The agent started and printed nothing")
    }

    /// A wait that ran out reports something that did NOT happen, which is news rather than
    /// punctuation — the ground `permissionExpired` takes attention ink on.
    @Test
    func `the row takes attention ink and ends no Turn`() {
        #expect(FeedMark.startedQuietly.ink == .attention)
        #expect(!FeedMark.startedQuietly.endsTurn)
    }
}
