import AppKit
import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// What survives another reading arriving in the same table, and what must not.
///
/// The deck used to answer this with `.id(session)`: SwiftUI destroyed the whole subtree, which
/// reset four row-keyed facts and threw away the `NSTableView`, ten measuring controllers, the
/// minimap and every measured height with them (ADR-0028 Rule 5). The identity is a value now
/// (`FeedReading`), so each of those facts has to be named — and each claim below is one of them,
/// on the RESET side or on the PRESERVED side.
///
/// A row-keyed fact resets: `FeedRow.ID` is a dense position, so a scroll latch, a focused row, a
/// fold or a wash carried across names whatever now stands where it was. A deck-keyed fact stays:
/// the pane width, the rulers, the scroll view, and the measured heights — which are per reading
/// and therefore still true when the reader comes back (`FeedGeometries`).
@Suite("Feed reading switch")
@MainActor
struct FeedReadingSwitchTests {
    // MARK: - preserved

    /// The claim the whole lane is for. A reader moving between Sessions pays for each reading
    /// ONCE, however many times they come back to it.
    @Test
    func `coming back to a Session already read measures not one row again`() async {
        let deck = FeedSwitchDeck()

        await deck.show(FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)
        let firstAlpha = deck.coordinator.measurements
        await deck.show(FeedSwitchFixture.bravoRows, of: FeedSwitchFixture.bravo)
        let throughBravo = deck.coordinator.measurements
        await deck.show(FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)

        // Each reading really was measured on first sight, or the zero below is a table that
        // never asked anything.
        #expect(firstAlpha >= FeedSwitchFixture.alphaRows.count)
        #expect(throughBravo - firstAlpha >= FeedSwitchFixture.bravoRows.count)
        // And the way back is free.
        #expect(deck.coordinator.measurements == throughBravo)
        #expect(deck.coordinator.exposures > 0)
    }

    /// The store is bounded (ADR-0028 Rule 4), so a window left open for a day does not hold every
    /// reading it has ever drawn.
    @Test
    func `the height stores are held for a handful of readings and no more`() {
        let geometries = FeedGeometries()

        for session in 0 ... ReadingCeilings.readings {
            _ = geometries.geometry(for: FeedReading(session: "session \(session)"))
        }

        #expect(geometries.count == ReadingCeilings.readings)
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

    /// A follow latch is a fact about rows the reader can see. Carried across it says they are at
    /// the end of a reading they have never looked at, and the way-back control disappears from a
    /// Session that opened mid-scroll.
    @Test
    func `the reader's place in one reading is not carried into the next`() async throws {
        let deck = FeedSwitchDeck()
        await deck.show(FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)
        let scroller = try #require(deck.coordinator.scroller)
        // The reader scrolls up off the end, which breaks the follow and names where they left.
        _ = deck.handle.resolve(.readerScrolled(
            offset: 0, pane: scroller.contentView.bounds.height, reading: 9000,
        ))
        #expect(!deck.handle.isFollowing)
        #expect(deck.handle.leftAt != nil)

        await deck.show(FeedSwitchFixture.bravoRows, of: FeedSwitchFixture.bravo)

        #expect(deck.handle.isFollowing)
        #expect(deck.handle.leftAt == nil)
    }

    /// The keyboard's row is an index. Left standing it draws the cursor on whatever now sits
    /// there, in a reading the reader has not arrowed into.
    @Test
    func `the keyboard's row does not follow the reader into another Session`() async {
        let deck = FeedSwitchDeck()
        await deck.show(FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)
        deck.coordinator.focusedRow = 40

        await deck.show(FeedSwitchFixture.bravoRows, of: FeedSwitchFixture.bravo)

        #expect(deck.coordinator.focusedRow == nil)
    }

    /// A fold is a row position too, and it is `FeedView`'s to reset — synchronously, because an
    /// `onChange` fires after the pass that has already handed those folds to the table.
    @Test
    func `folds belong to the reading they were made in`() {
        let made = FeedFact(reading: FeedSwitchFixture.alpha, value: Set<FeedRow.ID>([3, 9]))

        #expect(FeedView.folds(made, of: FeedSwitchFixture.alpha, opening: []) == [3, 9])
        #expect(FeedView.folds(made, of: FeedSwitchFixture.bravo, opening: []).isEmpty)
        #expect(FeedView.folds(nil, of: FeedSwitchFixture.alpha, opening: [7]) == [7])
    }

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

    /// The opening scroll is owed again: a reading arriving in a table already scrolled somewhere
    /// opens where the last one was left, which is the one place nobody asked to be.
    @Test
    func `a reading that arrives in a standing table opens at its own end`() async throws {
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
