@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// The roster's ONE selected state. Argo draws its own ground and the `List` draws the platform's
/// fill, and the two read the same value here so they can never land on different rows.
///
/// What this suite cannot see is the `List` itself — a package test builds a projection and cannot
/// click. That the platform is actually refused on a fold is `RosterSelectionE2ETests`.
@Suite("Roster selection")
struct RosterSelectionTests {
    private let loop = RosterFoldFixture.loop

    /// The whole roster a fold puts on screen: the fold's own row, the runs under it, and a
    /// Session outside it — every shape the claims below have to hold for.
    private func rows(selection: String?) -> [SessionRosterProjection.Row] {
        let sessions = RosterFoldFixture.runs(3, at: loop)
            + [RosterFoldFixture.run(at: nil, entry: .interactive, index: 9)]
        return SessionRosterProjection.rows(
            from: sessions, opened: [], focus: .init(sessionID: selection),
        )
    }

    @Test
    func `the ground lands on the one row the List selected`() {
        let drawn = rows(selection: "run-1")
        let selection = SessionRosterProjection.Selection(named: "run-1")

        #expect(drawn.filter(selection.isSelected).map(\.id) == ["run-1"])
    }

    /// A Fold is OPENED, never selected (`CONTEXT.md` "Surfaces, not entities" · Fold). It may
    /// therefore not take the `List`'s selection either: a row the platform can highlight and
    /// Argo cannot ground is a second selected state on screen.
    @Test
    func `a fold takes no selection`() throws {
        let fold = try #require(rows(selection: nil).first { $0.fold != nil })

        #expect(!fold.takesSelection)
    }

    /// The same sentence from the ground's side: a selection naming a fold grounds nothing at all,
    /// rather than grounding the row the platform would have filled.
    @Test
    func `a selection naming a fold draws no ground`() throws {
        let drawn = rows(selection: nil)
        let fold = try #require(drawn.first { $0.fold != nil })
        let selection = SessionRosterProjection.Selection(named: fold.id)

        #expect(drawn.filter(selection.isSelected).isEmpty)
    }

    /// A range grounds every row in it, not just the one the deck is drawing (#1247).
    @Test
    func `the ground lands on every row of a range`() {
        let drawn = rows(selection: "run-1")
        let selection = SessionRosterProjection.Selection(rows: ["run-1", "run-2"])

        #expect(drawn.filter(selection.isSelected).map(\.id) == ["run-1", "run-2"])
    }

    /// The menu's Archive acts on the whole selection when the pointer's row is in it, and on
    /// that row alone when it is not — in the ROSTER's order, which a set does not have.
    @Test
    func `archive covers the selection the pointer's row is in`() throws {
        let drawn = rows(selection: "run-1").filter(\.takesSelection)
        let pointed = try #require(drawn.last)
        let ids = drawn.map(\.id)

        #expect(SessionRosterProjection.archiveTargets(
            under: pointed, aimed: [pointed.id, ids[0]], in: drawn,
        ) == [ids[0], pointed.id])
        #expect(SessionRosterProjection.archiveTargets(
            under: pointed, aimed: [pointed.id], in: drawn,
        ) == [pointed.id])
    }

    /// A selection spanning the foot is cut at it: the menu says ONE verb and a count, and putting
    /// a Session back is the opposite act to archiving one.
    @Test
    @MainActor
    func `archive never reaches across the foot`() throws {
        let kept = ArchivedRosterSpecimen.rows
        let behind = ArchivedRosterSpecimen.archived
        let pointed = try #require(kept.first { $0.takesSelection })
        let everything = Set((kept + behind).map(\.id))

        #expect(SessionRosterProjection.archiveTargets(
            under: pointed, aimed: everything, in: kept + behind,
        ) == kept.filter(\.takesSelection).map(\.id))
    }
}
