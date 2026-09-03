import AppKit
@testable import ArgoUI
import Testing

/// What eviction costs the reader, and what a burst of clicks may never do to a deck.
///
/// Two halves of ADR-0030 Rule 4 that only a real deck can answer: the heights outlive the deck
/// they were measured for, and no deck ever holds two readings at once.
@Suite("Kept deck eviction")
@MainActor
struct KeptDeckEvictionTests {
    private static let charlie = FeedReading(session: "charlie")
    private static let charlieRows = FeedSwitchFixture.rows("Charlie", count: 70)

    /// The heights are held under a wider bound than the decks, so a Session pushed out re-opens
    /// over geometry nothing has to measure again — the second half of the cap's argument, and the
    /// reason a small cap costs the reader a table rather than a wait.
    @Test
    func `a Session evicted from the decks re-opens with no measure`() async throws {
        let deck = FeedSwitchDeck(cap: 2)
        await deck.show(FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)
        await deck.show(FeedSwitchFixture.bravoRows, of: FeedSwitchFixture.bravo)

        await deck.show(Self.charlieRows, of: Self.charlie)

        // The deck really is gone, and the heights really are not.
        #expect(deck.kept(FeedSwitchFixture.alpha) == nil)
        #expect(deck.geometries.geometry(for: FeedSwitchFixture.alpha).isSettled)

        await deck.show(FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)
        let reopened = try #require(deck.kept(FeedSwitchFixture.alpha))

        #expect(reopened.coordinator.measurements == 0)
        #expect(reopened.coordinator.table?.numberOfRows == FeedSwitchFixture.alphaRows.count)
        #expect(reopened.handle.isDrawing)
    }

    /// The overprint on `9f6cd7d4`, and why it cannot happen again.
    ///
    /// Two clicks inside the same beat used to arrive at ONE table: the second reading's rows were
    /// landed through the reload the first one's document had already asked for, and the reader saw
    /// both drawn over each other. There is no shared table to overprint now — each reading's rows
    /// are drawn by the deck that measured them, and this asks every deck the burst touched.
    @Test
    func `a rapid double switch never draws two readings in one deck`() async throws {
        let deck = FeedSwitchDeck()

        // Three clicks with nothing awaited between them — under the 300 ms a reader takes.
        deck.click(FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)
        deck.click(FeedSwitchFixture.bravoRows, of: FeedSwitchFixture.bravo)
        deck.click(FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)
        await deck.settleEvery()

        #expect(deck.decks.count == 2)
        for kept in deck.decks.decks {
            let named = try #require(kept.reading.session)
            #expect(!kept.coordinator.shown.isEmpty)
            #expect(kept.coordinator.shown.allSatisfy { Self.said($0)?.hasPrefix(named) == true })
            #expect(kept.coordinator.table?.numberOfRows == kept.coordinator.shown.count)
        }
    }

    /// Which reading a row came from, spelled into its words by the fixture: `alpha`'s rows all
    /// begin `alpha`, `bravo`'s all begin `bravo`. Lower-cased because the reading is named in
    /// lower case and the rows are written in title case.
    private static func said(_ row: FeedRow) -> String? {
        guard case let .message(words) = row.content else { return nil }
        return words.lowercased()
    }
}
