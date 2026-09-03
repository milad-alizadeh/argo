import AppKit
@testable import ArgoUI
import Testing

/// The same switch, in the two passes the shell now takes it in.
///
/// `DrawnSession` moved the reading off the pass that paints the click, so the deck is handed the
/// new Session with an EMPTY feed first and its rows a turn later. Every claim in
/// `FeedReadingSwitchTests` has to survive being made in two steps rather than one, and the
/// preserved half nearly did not: an empty reading went through `dropBeyond(0)` and took every
/// measured height with it, so a reader coming back to a Session paid for all of it again — the
/// exact cost `FeedGeometries` exists to have removed (#858), reintroduced by the pass in front of
/// it.
///
/// A file of its own because the suite it extends is at its length ceiling, and because these are
/// one thing: what an empty feed is allowed to mean.
extension FeedReadingSwitchTests {
    /// The lane's own claim, taken the way the shell now takes it.
    @Test
    func `a switch taken in two passes still measures each reading once`() async throws {
        let deck = FeedSwitchDeck()

        await deck.switching(to: FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)
        let alpha = try #require(deck.kept(FeedSwitchFixture.alpha))
        let firstAlpha = alpha.coordinator.measurements
        await deck.switching(to: FeedSwitchFixture.bravoRows, of: FeedSwitchFixture.bravo)
        let bravo = try #require(deck.kept(FeedSwitchFixture.bravo))
        await deck.switching(to: FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)

        // Each reading really was measured on first sight, or the equality below is a table that
        // never asked anything.
        #expect(firstAlpha >= FeedSwitchFixture.alphaRows.count)
        #expect(bravo.coordinator.measurements >= FeedSwitchFixture.bravoRows.count)
        // And the way back is still free, through the empty pass rather than around it.
        #expect(alpha.coordinator.measurements == firstAlpha)
    }

    /// The opening scroll is owed to the rows, not to the pass that had none — or a switch would
    /// land the reader at the top of a reading that opens at its tail (ADR-0029).
    @Test
    func `a reading deferred by a pass still opens at its own end`() async throws {
        let deck = FeedSwitchDeck()
        await deck.switching(to: FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)

        await deck.switching(to: FeedSwitchFixture.bravoRows, of: FeedSwitchFixture.bravo)

        let table = try #require(deck.coordinator.table)
        let offset = try #require(deck.coordinator.offset())
        // Below the top of the reading by more than a pane, which only the end can be.
        #expect(offset > table.frame.height - FeedSwitchDeck.pane.height - 1)
        #expect(deck.handle.isFollowing)
    }

    /// The empty pass is a DEFERRAL and never a reading that emptied, and a kept deck is where the
    /// difference shows: the deck the reader is coming back to goes on drawing the rows that are on
    /// their way to it, so nothing blinks and the offset they left it at is still theirs.
    @Test
    func `an empty feed does not blank the deck it arrives at`() async throws {
        let deck = FeedSwitchDeck()
        await deck.switching(to: FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)
        let drawn = try #require(deck.coordinator.table?.numberOfRows)
        let offset = try #require(deck.coordinator.offset())

        await deck.show([], of: FeedSwitchFixture.alpha)

        #expect(deck.coordinator.table?.numberOfRows == drawn)
        #expect(deck.coordinator.offset() == offset)
        #expect(deck.handle.isDrawing)
    }
}
