import AppKit
@testable import ArgoUI
import Testing

/// What the reader keeps across a switch, what an eviction costs them, and what a burst of clicks
/// may never put on screen.
///
/// Three halves of ADR-0030 Rule 4 that only a real deck can answer: the folds are the deck's, the
/// heights outlive the deck they were measured for, and one deck is on screen at a time.
@Suite("Kept deck eviction")
@MainActor
struct KeptDeckEvictionTests {
    private static let charlie = FeedReading(session: "charlie")
    private static let charlieRows = FeedSwitchFixture.rows("Charlie", count: 70)

    /// A fold is a row position, and it belongs to the deck the reader made it in — so it is still
    /// there on the way back, and it is not in the deck they went to. Read off the COORDINATOR,
    /// which is what the cells were actually drawn against.
    @Test
    func `a fold made in one deck is still there on the way back`() async throws {
        let deck = FeedSwitchDeck()
        await deck.show(FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)
        let alpha = try #require(deck.kept(FeedSwitchFixture.alpha))
        alpha.folds = [3, 9]
        await deck.show(FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)
        #expect(alpha.coordinator.folds == [3, 9])

        await deck.show(FeedSwitchFixture.bravoRows, of: FeedSwitchFixture.bravo)
        let bravo = try #require(deck.kept(FeedSwitchFixture.bravo))
        await deck.show(FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)

        #expect(bravo.folds == nil)
        #expect(bravo.coordinator.folds.isEmpty)
        #expect(alpha.folds == [3, 9])
        #expect(alpha.coordinator.folds == [3, 9])
    }

    /// The heights are held under a wider bound than the decks, so a Session pushed out re-opens
    /// over geometry nothing has to measure again — the second half of the cap's argument, and the
    /// reason a small cap costs the reader a table rather than a wait.
    ///
    /// Nothing here is gated in SECONDS, and the criterion's "inside the delay" is exactly this
    /// count: a re-open that measures no row has no pass to wait for. A seconds gate on a shared
    /// laptop reads the box rather than the code (ADR-0028 Rule 8).
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

    /// Two clicks inside one beat, which is what the overprint on `9f6cd7d4` was: the second
    /// reading's rows landed through a reload the first one's document had already asked for, and
    /// the reader saw both drawn over each other.
    ///
    /// It is a guard rather than that defect's reproduction, and the difference is worth stating:
    /// there is no shared table left for a burst to overprint, so what this holds is that the
    /// construction stays — one deck per reading, one of them on screen, and each drawing only the
    /// rows it measured. A case written against the old single table could not be carried over,
    /// because the API it drove is deleted.
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
        // And exactly one of them is what the reader is looking at: the last one clicked.
        let shown = deck.stack.subviews.filter { !$0.isHidden }
        #expect(shown.count == 1)
        #expect(shown.first === deck.kept(FeedSwitchFixture.alpha)?.scroller)
    }

    /// Which reading a row came from, spelled into its words by the fixture: `alpha`'s rows all
    /// begin `alpha`, `bravo`'s all begin `bravo`. Lower-cased because the reading is named in
    /// lower case and the rows are written in title case.
    private static func said(_ row: FeedRow) -> String? {
        guard case let .message(words) = row.content else { return nil }
        return words.lowercased()
    }
}
