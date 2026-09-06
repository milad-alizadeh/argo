@testable import ArgoUI
import Testing

/// Which row the roster scrolls to when the selection is changed from somewhere else (#1273).
///
/// The state this refuses: the deck is opened on a Session from the Tickets room, the roster marks
/// its row, and the row is thirty rows down where nobody can see it. A roster that draws a mark
/// out of view answers "which Session am I in" no better than a roster that draws none.
@Suite("Roster reveal")
struct RosterRevealTests {
    @Test
    func `the selected row is the row the roster reveals`() {
        let reveal = SessionRosterProjection.reveal(
            of: "beta", among: rows("alpha", "beta"), hasHeight: true,
        )

        #expect(reveal == .init(row: "beta", owed: nil))
    }

    /// Nothing selected is nothing to scroll to. The offset is the reader's.
    @Test
    func `no selection reveals nothing`() {
        let reveal = SessionRosterProjection.reveal(
            of: nil, among: rows("alpha"), hasHeight: true,
        )

        #expect(reveal == .init(row: nil, owed: nil))
    }

    /// A selection no drawn row carries — a Session behind a shut foot, a fresh spawn whose
    /// provisional row has not reached this list, or one the shell was handed before it
    /// reconciled. The list cannot scroll to a row it does not have, so it OWES the look rather
    /// than dropping it (#1493): dropping it left the row grounded and out of sight, which reads
    /// exactly like a lost focus.
    @Test
    func `a selection no row draws yet is owed rather than dropped`() {
        let reveal = SessionRosterProjection.reveal(
            of: "gamma", among: rows("alpha"), hasHeight: true,
        )

        #expect(reveal == .init(row: nil, owed: "gamma"))
    }

    /// And paid the moment that row is published, with the selection unchanged — the change that
    /// settles this debt is the ROSTER's, not the reader's (`RosterReveal`).
    @Test
    func `the owed row is revealed once the roster publishes it`() {
        let reveal = SessionRosterProjection.reveal(
            of: "gamma", among: rows("alpha", "gamma"), hasHeight: true,
        )

        #expect(reveal == .init(row: "gamma", owed: nil))
    }

    /// A fold is OPENED, never selected (`CONTEXT.md` "Surfaces, not entities" · Fold), so it
    /// carries no ground — and a scroll to a row with no mark on it is the list moving to show the
    /// reader nothing. It is also the one id that owes nothing while being undrawn-as-a-ground: a
    /// fold is already on screen, so there is no row coming that would settle a debt for it.
    @Test
    func `a fold row is never revealed`() throws {
        let drawn = SessionRosterProjection.rows(
            from: RosterFoldFixture.runs(3, at: RosterFoldFixture.loop),
        )
        let fold = try #require(drawn.first { $0.fold != nil })

        let reveal = SessionRosterProjection.reveal(of: fold.id, among: drawn, hasHeight: true)

        #expect(reveal == .init(row: nil, owed: nil))
    }

    /// The roster's own room off screen: `RoomStage` keeps the view mounted at `maxHeight: 0`, and
    /// `TicketsRoom.openSession` writes the selection BEFORE it switches rooms. A list with no
    /// height cannot be scrolled, so the ask is owed rather than spent — spending it there is the
    /// bug wearing a fix.
    @Test
    func `a roster with no height owes the reveal instead of spending it`() {
        let reveal = SessionRosterProjection.reveal(
            of: "beta", among: rows("alpha", "beta"), hasHeight: false,
        )

        #expect(reveal == .init(row: nil, owed: "beta"))
    }

    /// Both debts at once — no height AND no row — which is the shape `Start` on a ticket makes:
    /// the claim id is written while the Tickets room still has the column and before the
    /// provisional row is published. One debt, recorded under the id that is owed.
    @Test
    func `a roster with neither height nor a row owes the selection itself`() {
        let reveal = SessionRosterProjection.reveal(
            of: "gamma", among: rows("alpha"), hasHeight: false,
        )

        #expect(reveal == .init(row: nil, owed: "gamma"))
    }

    private func rows(_ ids: String...) -> [SessionRosterProjection.Row] {
        SessionRosterProjection.rows(from: ids.map { RosterSessionFixture.session(id: $0) })
    }
}
