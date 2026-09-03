import AppKit
@testable import ArgoUI
import Testing

/// What a kept deck survives beyond a plain Session-to-Session switch (ADR-0030, Rule 4, lane 4b):
/// the room switch that tears the feed's whole SwiftUI subtree down, scoping onto a Subagent's own
/// reading, and a Session that grows while its deck is off screen.
///
/// Each claim below drives the shipped store — `KeptDecks`, `FeedDeckStack`, `FeedScrollPolicy` —
/// through `FeedSwitchDeck`, the same harness `FeedReadingSwitchTests` drives. Nothing here stands
/// in for the shell: a room switch is the one thing `FeedSwitchDeck` does not model on its own, so
/// each room claim rebuilds the `FeedDeckStack` by hand, which is the one AppKit fact
/// `FeedTable.makeNSView` adds on the way back into the Sessions room.
@Suite("Kept deck survival")
@MainActor
struct KeptDeckSurvivalTests {
    // MARK: - room round trip

    /// `InstrumentDeckShell`'s room `switch` destroys `FeedTable`'s view identity, so coming back
    /// into the Sessions room makes a FRESH `FeedDeckStack` (`FeedTable.makeNSView`).
    /// The deck it re-parents into that stack is the same one the reader left, offset and folds
    /// untouched — a room switch must cost nothing more than that reparenting.
    @Test
    func `a room round trip leaves the deck's scroll position and folds untouched`() async throws {
        let deck = FeedSwitchDeck()
        await deck.show(FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)
        let alpha = try #require(deck.kept(FeedSwitchFixture.alpha))
        alpha.folds = [3, 9]
        _ = alpha.handle.resolve(.readerScrolled(
            offset: 0, pane: alpha.scroller.contentView.bounds.height, reading: 9000,
        ))
        #expect(!alpha.handle.isFollowing)
        let offsetBefore = alpha.coordinator.offset()
        let measurementsBefore = alpha.coordinator.measurements

        // The room switch: a new stack, the same deck re-shown on it — what `FeedTable` does on the
        // way back into `.sessions`.
        let freshStack = FeedDeckStack()
        freshStack.frame = deck.stack.frame
        freshStack.show(alpha)
        freshStack.layoutSubtreeIfNeeded()

        #expect(alpha.folds == [3, 9])
        #expect(!alpha.handle.isFollowing)
        #expect(alpha.handle.leftAt != nil)
        #expect(alpha.coordinator.offset() == offsetBefore)
        // No row was measured a second time for a switch that never left the deck it stood in.
        #expect(alpha.coordinator.measurements == measurementsBefore)
    }

    // MARK: - subagent scope round trip

    /// Scoping the rail onto a Subagent re-keys the reading (`FeedReading.scope`), which is what
    /// gives it its own kept deck (`KeptDecks.show`). Leaving it for the Session's own reading must
    /// not touch the parent's deck, and coming back to the Subagent must not re-measure what it
    /// already read.
    @Test
    func `a Subagent scope keeps its own deck, and the parent's is untouched on return`(
    ) async throws {
        let deck = FeedSwitchDeck()
        let session = FeedSwitchFixture.alpha
        let scope = FeedReading(session: "alpha", scope: .subagent(7))

        await deck.show(FeedSwitchFixture.alphaRows, of: session)
        let parent = try #require(deck.kept(session))
        parent.folds = [4]
        _ = parent.handle.resolve(.readerScrolled(
            offset: 0, pane: parent.scroller.contentView.bounds.height, reading: 9000,
        ))
        // The fold just made owes its own row a remeasure — let that land before the baseline, so
        // the round trip below is measured against a document that already knows about it.
        await deck.show(FeedSwitchFixture.alphaRows, of: session)
        let parentOffset = parent.coordinator.offset()
        let parentMeasurements = parent.coordinator.measurements

        let subagentRows = FeedSwitchFixture.rows("Subagent", count: 60)
        await deck.show(subagentRows, of: scope)
        let scoped = try #require(deck.kept(scope))
        #expect(scoped !== parent)
        scoped.folds = [1, 2]
        _ = scoped.handle.resolve(.readerScrolled(
            offset: 0, pane: scoped.scroller.contentView.bounds.height, reading: 4000,
        ))
        await deck.show(subagentRows, of: scope)
        let scopedMeasurements = scoped.coordinator.measurements

        // Back to the Session's own reading.
        await deck.show(FeedSwitchFixture.alphaRows, of: session)

        #expect(parent.folds == [4])
        #expect(!parent.handle.isFollowing)
        #expect(parent.coordinator.offset() == parentOffset)
        #expect(parent.coordinator.measurements == parentMeasurements)

        // And the Subagent's own deck, found again, keeps what it was left at — no second measure
        // of rows it already read.
        await deck.show(subagentRows, of: scope)
        let scopedAgain = try #require(deck.kept(scope))
        #expect(scopedAgain === scoped)
        #expect(scopedAgain.folds == [1, 2])
        #expect(!scopedAgain.handle.isFollowing)
        #expect(scopedAgain.coordinator.measurements == scopedMeasurements)
    }

    // MARK: - tail-pin is a state, a row is a position

    /// A deck pinned to the tail (ADR-0029) that grows while its view is unmounted lands at the
    /// CURRENT tail on return, never at the row it happened to hold when it was last drawn — the
    /// live-growth path reaches a hidden deck's own coordinator directly, the way a model update
    /// reaches any kept deck whether or not its view is on screen.
    @Test
    func `a deck pinned to the tail returns at the new tail after growing off screen`(
    ) async throws {
        let deck = FeedSwitchDeck()
        await deck.show(FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)
        let alpha = try #require(deck.kept(FeedSwitchFixture.alpha))
        #expect(alpha.handle.isFollowing)

        // Hidden behind another reading.
        await deck.show(FeedSwitchFixture.bravoRows, of: FeedSwitchFixture.bravo)

        try await grow(alpha, from: FeedSwitchFixture.alphaRows, by: 40)

        deck.stack.show(alpha)
        alpha.scroller.layoutSubtreeIfNeeded()
        try await settlePasses()

        let offset = try #require(alpha.coordinator.offset())
        let table = try #require(alpha.coordinator.table)
        // Below the top of the reading by more than a pane, which only the new tail can be.
        #expect(offset > table.frame.height - FeedSwitchDeck.pane.height - 1)
        #expect(alpha.handle.isFollowing)
    }

    /// A deck left on a fixed row is left there because the reader chose it — following broke and
    /// `leftAt` named the row. Rows arriving below while it is hidden must not move it: the
    /// position is a fact about where the reader is, not about how much of the reading now exists.
    @Test
    func `a deck left on a row returns on it, unmoved by growth off screen`() async throws {
        let deck = FeedSwitchDeck()
        await deck.show(FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)
        let alpha = try #require(deck.kept(FeedSwitchFixture.alpha))
        _ = alpha.handle.resolve(.readerScrolled(
            offset: 0, pane: alpha.scroller.contentView.bounds.height, reading: 9000,
        ))
        #expect(!alpha.handle.isFollowing)
        let offsetBefore = try #require(alpha.coordinator.offset())
        let leftAtBefore = alpha.handle.leftAt

        await deck.show(FeedSwitchFixture.bravoRows, of: FeedSwitchFixture.bravo)

        try await grow(alpha, from: FeedSwitchFixture.alphaRows, by: 40)

        deck.stack.show(alpha)
        alpha.scroller.layoutSubtreeIfNeeded()
        try await settlePasses()

        #expect(!alpha.handle.isFollowing)
        #expect(alpha.handle.leftAt == leftAtBefore)
        #expect(alpha.coordinator.offset() == offsetBefore)
    }

    /// Rows appended straight to a hidden deck's coordinator — no view mounted to carry them in,
    /// the way a live Session's growth reaches a deck whether or not it is the one drawn.
    private func grow(_ deck: KeptDeck, from rows: [FeedRow], by count: Int) async throws {
        let appended = rows + (rows.count ..< rows.count + count).map {
            FeedRow(id: $0, content: .message("Alpha line \($0), appended while hidden."))
        }
        deck.coordinator.apply(FeedTableFixture.model(
            showing: appended,
            unfolded: deck.folds ?? [],
        ))
        await FeedTableFixture.settled(deck.coordinator)
    }

    private func settlePasses() async throws {
        for _ in 0 ... FeedTableCoordinator.panePasses {
            try? await Task.sleep(for: .milliseconds(1))
        }
    }
}
