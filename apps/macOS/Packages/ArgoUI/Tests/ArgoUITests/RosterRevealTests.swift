@testable import ArgoUI
import Testing

/// Which row the roster scrolls to when the selection is changed from somewhere else (#1273).
///
/// The state this refuses: the deck is opened on a Session from the Tickets room, the roster marks
/// its row, and the row is thirty rows down where nobody can see it. A roster that draws a mark
/// out of view says no more than a roster that draws none.
@Suite("Roster reveal")
struct RosterRevealTests {
    @Test
    func `the selected row is the row the roster reveals`() {
        let reveal = SessionRosterProjection.rowToReveal(for: "beta", among: rows("alpha", "beta"))

        #expect(reveal == "beta")
    }

    /// Nothing selected is nothing to scroll to. The offset is the reader's.
    @Test
    func `no selection reveals nothing`() {
        #expect(SessionRosterProjection.rowToReveal(for: nil, among: rows("alpha")) == nil)
    }

    /// A selection no drawn row carries — a Session behind a shut foot, or one the Hub stopped
    /// publishing before the shell reconciled. Asking the list for a row it is not drawing moves
    /// the offset for a mark that is not there.
    @Test
    func `a selection no row draws reveals nothing`() {
        #expect(SessionRosterProjection.rowToReveal(for: "gamma", among: rows("alpha")) == nil)
    }

    /// A fold is OPENED, never selected (`CONTEXT.md` "Surfaces, not entities" · Fold), so it
    /// carries no ground — and a scroll to a row with no mark on it is the list moving to show
    /// the reader nothing.
    @Test
    func `a fold row is never revealed`() throws {
        let drawn = SessionRosterProjection.rows(
            from: RosterFoldFixture.runs(3, at: RosterFoldFixture.loop),
        )
        let fold = try #require(drawn.first { $0.fold != nil })

        #expect(SessionRosterProjection.rowToReveal(for: fold.id, among: drawn) == nil)
    }

    private func rows(_ ids: String...) -> [SessionRosterProjection.Row] {
        SessionRosterProjection.rows(from: ids.map { RosterSessionFixture.session(id: $0) })
    }
}
