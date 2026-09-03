import AppKit
import ArgoEngine
@testable import ArgoUI
import Testing

/// What the reader keeps when they leave a Session, and what belongs to the reading they left.
///
/// The deck used to answer this with `.id(session)`: SwiftUI destroyed the whole subtree, which
/// reset four row-keyed facts and threw away the `NSTableView`, ten measuring controllers, the
/// minimap and every measured height with them (ADR-0028 Rule 5). Then it answered it with one
/// table re-pointed at each reading in turn, which is the overprint on `9f6cd7d4`.
///
/// It is neither now. Every reading has its OWN deck — table, scroll position and folds — kept off
/// screen and shown again unchanged (ADR-0030, Rule 4), so a fact that used to have to be reset on
/// the way in is a fact of the deck it was made in. Each claim below is one of those: on the KEPT
/// side, or on the side that stays behind with the deck that owns it.
@Suite("Feed reading switch")
@MainActor
struct FeedReadingSwitchTests {
    // MARK: - kept

    /// The claim the whole lane is for. A reader moving between Sessions pays for each reading
    /// ONCE, however many times they come back to it.
    @Test
    func `coming back to a Session already read measures not one row again`() async throws {
        let deck = FeedSwitchDeck()

        await deck.show(FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)
        let alpha = try #require(deck.kept(FeedSwitchFixture.alpha))
        let firstAlpha = alpha.coordinator.measurements
        await deck.show(FeedSwitchFixture.bravoRows, of: FeedSwitchFixture.bravo)
        let bravo = try #require(deck.kept(FeedSwitchFixture.bravo))
        await deck.show(FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)

        // Each reading really was measured on first sight, or the equality below is a table that
        // never asked anything.
        #expect(firstAlpha >= FeedSwitchFixture.alphaRows.count)
        #expect(bravo.coordinator.measurements >= FeedSwitchFixture.bravoRows.count)
        // And the way back is free.
        #expect(alpha.coordinator.measurements == firstAlpha)
        #expect(alpha.coordinator.exposures > 0)
    }

    /// One deck per reading and the same one on the way back — which is what makes every claim
    /// below a claim about a deck rather than about a reset.
    @Test
    func `each reading is read through its own deck, found again on the way back`() async throws {
        let deck = FeedSwitchDeck()

        await deck.show(FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)
        let alpha = try #require(deck.kept(FeedSwitchFixture.alpha))
        await deck.show(FeedSwitchFixture.bravoRows, of: FeedSwitchFixture.bravo)
        let bravo = try #require(deck.kept(FeedSwitchFixture.bravo))
        await deck.show(FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)

        #expect(alpha !== bravo)
        #expect(deck.kept(FeedSwitchFixture.alpha) === alpha)
        #expect(deck.deck === alpha)
    }

    /// Where the reader was in a reading is a fact about that reading, and the deck it was made in
    /// is still there. Carried into another Session it would say they are at the end of a reading
    /// they have never looked at; thrown away it would drop them back at the tail of one they had
    /// scrolled up in.
    @Test
    func `the reader's place is kept in the deck they left it in`() async throws {
        let deck = FeedSwitchDeck()
        await deck.show(FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)
        let alpha = try #require(deck.kept(FeedSwitchFixture.alpha))
        // The reader scrolls up off the end, which breaks the follow and names where they left.
        _ = alpha.handle.resolve(.readerScrolled(
            offset: 0, pane: alpha.scroller.contentView.bounds.height, reading: 9000,
        ))

        await deck.show(FeedSwitchFixture.bravoRows, of: FeedSwitchFixture.bravo)

        // The reading they arrived at opens at its own end, following.
        #expect(deck.handle.isFollowing)
        #expect(deck.handle.leftAt == nil)
        // And the one they left is still where they left it.
        #expect(!alpha.handle.isFollowing)
        #expect(alpha.handle.leftAt != nil)
    }

    /// The keyboard's row is an index into ONE reading. Left standing in another it would draw the
    /// cursor on whatever now sits there; the deck it was arrowed in keeps it.
    @Test
    func `the keyboard's row stays in the deck it was arrowed in`() async throws {
        let deck = FeedSwitchDeck()
        await deck.show(FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)
        let alpha = try #require(deck.kept(FeedSwitchFixture.alpha))
        alpha.coordinator.focusedRow = 40

        await deck.show(FeedSwitchFixture.bravoRows, of: FeedSwitchFixture.bravo)

        #expect(deck.coordinator.focusedRow == nil)
        #expect(alpha.coordinator.focusedRow == 40)
    }

    /// A fold is a row position too, and it belongs to the deck the reader made it in.
    @Test
    func `folds belong to the deck they were made in`() {
        let decks = KeptDecks()
        let alpha = decks.show(FeedSwitchFixture.alpha)
        alpha.folds = [3, 9]

        #expect(FeedView.folds(alpha.folds, opening: []) == [3, 9])
        #expect(FeedView.folds(decks.show(FeedSwitchFixture.bravo).folds, opening: []).isEmpty)
        #expect(FeedView.folds(nil, opening: [7]) == [7])
    }

    // MARK: - bounded

    /// The height store is bounded (ADR-0028 Rule 4), and by a wider bound than the decks: a
    /// Session pushed out of the decks re-opens over geometry nothing has to measure again.
    @Test
    func `the height stores are held for a handful of readings and no more`() {
        let geometries = FeedGeometries()

        for session in 0 ... ReadingCeilings.readings {
            _ = geometries.geometry(for: FeedReading(session: "session \(session)"))
        }

        #expect(geometries.count == ReadingCeilings.readings)
        #expect(KeptDecks.defaultCap < ReadingCeilings.readings)
    }

    /// A scope switch is another reading of the same Session — the rail scoped onto a Subagent —
    /// and it gets its own heights rather than overwriting the Session's.
    @Test
    func `a scope of the same Session keeps its own heights`() {
        let geometries = FeedGeometries()
        let session = geometries.geometry(for: FeedReading(session: "alpha"))

        let scoped = geometries
            .geometry(for: FeedReading(session: "alpha", scope: .subagent(7)))

        #expect(session !== scoped)
    }

    // MARK: - reset

    /// The wash means *what you just sent landed*. A Session with more rows in it than the last is
    /// not an arrival, and washing its newest prompt would credit the reader with words the agent
    /// was handed before they ever opened it.
    @Test
    func `another reading's rows are not an arrival`() {
        let rows = FeedSwitchFixture.alphaRows

        let arrived = FeedView.wash(
            from: FeedFact(reading: FeedSwitchFixture.alpha, value: rows.count - 1),
            to: FeedFact(reading: FeedSwitchFixture.alpha, value: rows.count),
            in: rows,
        )
        let switched = FeedView.wash(
            from: FeedFact(reading: FeedSwitchFixture.bravo, value: 2),
            to: FeedFact(reading: FeedSwitchFixture.alpha, value: rows.count),
            in: rows,
        )

        #expect(arrived == .keep)
        #expect(switched == .clear)
    }

    /// A reading opens at its own end in its own deck (ADR-0029) — never at the offset the last
    /// one was being read at, because it never opens in the last one's table.
    @Test
    func `a reading opens at its own end`() async throws {
        let deck = FeedSwitchDeck()
        await deck.show(FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)

        await deck.show(FeedSwitchFixture.bravoRows, of: FeedSwitchFixture.bravo)
        let table = try #require(deck.coordinator.table)
        let offset = try #require(deck.coordinator.offset())

        // Below the top of the reading by more than a pane, which only the end can be.
        #expect(offset > table.frame.height - FeedSwitchDeck.pane.height - 1)
        #expect(deck.handle.isFollowing)
    }
}
