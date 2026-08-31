@testable import ArgoUI
import Testing

/// Clicking a chip in the agents rail re-scopes the deck's ONE feed (D33), and what the feed draws
/// afterwards is the rows the scope names — never the ones it was showing before.
///
/// Asked of a STAMPED reading, which is the only kind the running app has: an unstamped
/// `FeedAgentReadings` derives every answer, so a suite that builds one by hand tests the
/// derivation and not the memo the deck actually reads through
/// (`SessionsRoomReadingCache.scoped(at:under:)`).
@Suite("Feed scope switch", .serialized)
@MainActor
struct FeedScopeSwitchTests {
    @Test
    func `scoping onto a subagent draws that subagent's rows`() throws {
        let reading = FeedScopeFixture.fanOut()
        let one = try #require(FeedScopeFixture.chip("a-one", in: reading))

        let scoped = reading.readings.reading(of: reading.feed, under: .subagent(one))

        #expect(scoped.map(\.content) == [.message(FeedScopeFixture.saidByOne)])
    }

    /// The way back out, which is the same chip clicked again — see `AgentsRail.select(_:)`.
    @Test
    func `scoping back to the session restores the session's own rows`() throws {
        let reading = FeedScopeFixture.fanOut()
        let one = try #require(FeedScopeFixture.chip("a-one", in: reading))

        _ = reading.readings.reading(of: reading.feed, under: .subagent(one))
        let back = reading.readings.reading(of: reading.feed, under: .session)

        #expect(back == reading.feed)
    }

    /// A → B → A. The middle answer is the one a memo keyed on anything but the scope swallows,
    /// and the third proves the first entry was not overwritten on the way through.
    @Test
    func `switching between two subagents shows each of them in turn`() throws {
        let reading = FeedScopeFixture.fanOut()
        let one = try #require(FeedScopeFixture.chip("a-one", in: reading))
        let two = try #require(FeedScopeFixture.chip("a-two", in: reading))

        let first = reading.readings.reading(of: reading.feed, under: .subagent(one))
        let second = reading.readings.reading(of: reading.feed, under: .subagent(two))
        let again = reading.readings.reading(of: reading.feed, under: .subagent(one))

        #expect(first.map(\.content) == [.message(FeedScopeFixture.saidByOne)])
        #expect(second.map(\.content) == Array(
            repeating: .message(FeedScopeFixture.saidByTwo),
            count: 2,
        ))
        #expect(again.map(\.content) == [.message(FeedScopeFixture.saidByOne)])
    }

    /// The memo's key, stated directly: two scopes at ONE stamp are two entries and two
    /// derivations. A key that ignored the scope would count one and answer the second reader with
    /// the first reader's rows.
    @Test
    func `the scoped memo is keyed by the scope and not by the session alone`() throws {
        SessionsRoomReadingCache.forget()
        let reading = FeedScopeFixture.fanOut(forgetting: false)
        let one = try #require(FeedScopeFixture.chip("a-one", in: reading))
        let two = try #require(FeedScopeFixture.chip("a-two", in: reading))

        for scope in [FeedScope.session, .subagent(one), .subagent(two), .session] {
            _ = reading.readings.reading(of: reading.feed, under: scope)
        }

        #expect(SessionsRoomReadingCache.cost.scopes == 3)
    }

    /// The rail's own list is the SESSION's whatever the feed is scoped to. Read off a scoped feed
    /// it would empty itself the moment somebody used it — and an empty list takes the scope down
    /// with it, because `rows(under:of:otherwise:)` falls back the moment nothing is running.
    @Test
    func `the rail still lists every agent while the feed is scoped onto one`() throws {
        let reading = FeedScopeFixture.fanOut()
        let one = try #require(FeedScopeFixture.chip("a-one", in: reading))
        let scoped = reading.readings.reading(of: reading.feed, under: .subagent(one))

        #expect(reading.readings.agents(in: reading.feed).count == 3)
        #expect(reading.readings.agents(in: scoped).count == 3)
    }

    /// The other memo's key. The list is a fact about the READING, so the cache derives it from the
    /// reading's own rows — a memo keyed on the stamp alone that forwarded the CALLER's rows let
    /// whoever asked first answer for everybody after them.
    @Test
    func `the agent list is derived from the reading and not from the rows asked with`() {
        let reading = FeedScopeFixture.fanOut()

        #expect(reading.readings.agents(in: []).count == 3)
        #expect(reading.readings.agents(in: reading.feed).count == 3)
    }

    // MARK: - the table the rows land in

    /// The claim at the far end of the path: the `NSTableView` the deck holds is showing the scoped
    /// rows, not the ones it was handed before. A scope switch is another `FeedReading` of the same
    /// Session, and the table is never destroyed for one (ADR-0028 Rule 5).
    @Test
    func `a scope switch puts the subagent's rows in the table`() async throws {
        let deck = FeedSwitchDeck()
        let session = FeedReading(session: "one")
        let scoped = FeedReading(session: "one", scope: .subagent(1))
        let sessionRows = FeedSwitchFixture.rows("Session", count: 40)
        let subagentRows = FeedSwitchFixture.rows("Subagent", count: 12)

        await deck.show(sessionRows, of: session)
        await deck.show(subagentRows, of: scoped)

        let table = try #require(deck.coordinator.table)
        #expect(deck.coordinator.shown == subagentRows)
        #expect(table.numberOfRows == subagentRows.count)

        await deck.show(sessionRows, of: session)
        #expect(deck.coordinator.shown == sessionRows)
        #expect(table.numberOfRows == sessionRows.count)
    }
}

/// The same click, through the REAL view tree: the deck hosted, the scope written into the state
/// the shell owns, and the rows counted off the `NSTableView` the deck built for itself.
///
/// The suite above holds the projection and the coordinator to their claims one at a time, and both
/// could pass while the deck on screen went on drawing the reading it had — nothing between them is
/// a value a test can hold. This is the one claim that spans the whole path.
@Suite("Feed scope switch, hosted", .serialized)
@MainActor
struct HostedFeedScopeSwitchTests {
    /// A → B → A, counted at the table. `a-two` reported two lines and `a-one` reported one, so the
    /// count alone says which reading is up — and the middle one is what a stale memo swallows.
    @Test(.enabled(if: WindowedTests.areAvailable))
    func `clicking a chip re-scopes the feed the deck is drawing`() throws {
        let deck = HostedDeck()
        let session = try deck.drawnRows

        try deck.scope(onto: "a-one")
        #expect(try deck.drawnRows == 1)
        try deck.scope(onto: "a-two")
        #expect(try deck.drawnRows == 2)
        try deck.scope(onto: "a-one")
        #expect(try deck.drawnRows == 1)

        deck.scopeBack()
        #expect(try deck.drawnRows == session)
        #expect(session > 2)
    }

    /// The live case, which is every case: the Session goes on talking while the reader is inside a
    /// Subagent. The stamp under which both readings are remembered moves on every line, and the
    /// scoped reading must neither follow the Session's growth nor be dropped by it.
    @Test(.enabled(if: WindowedTests.areAvailable))
    func `a session that goes on talking does not pull the reader out of a subagent`() throws {
        let deck = HostedDeck()
        let session = try deck.drawnRows
        try deck.scope(onto: "a-two")

        deck.grow()
        deck.grow()

        #expect(try deck.drawnRows == 2)
        deck.scopeBack()
        #expect(try deck.drawnRows == session + 2)
    }
}
