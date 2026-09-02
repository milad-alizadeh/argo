import ArgoDesign
import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// What a roster row says about being drivable — the ghosting, the mark, and the words a screen
/// reader hears in place of both.
@Suite("Session roster access")
struct SessionRosterAccessTests {
    @Test
    func `access is a fact about the whole row, not one the roster spends by comparison`() {
        let mixed = SessionRosterProjection.rows(
            from: [
                RosterSessionFixture.session(id: "managed", access: .managed),
                RosterSessionFixture.session(id: "external", access: .external),
            ],
        )
        let uniform = SessionRosterProjection.rows(
            from: [
                RosterSessionFixture.session(id: "one", access: .external),
                RosterSessionFixture.session(id: "two", access: .external),
            ],
        )

        #expect(mixed.map(\.isReadOnly) == [false, true])
        // A roster where every Session is read-only says so on every row.
        #expect(uniform.map(\.isReadOnly) == [true, true])
    }

    @Test
    func `a read-only Session announces the fact its ink cannot carry`() throws {
        let row = try #require(rows(RosterSessionFixture.session(id: "external", access: .external))
            .first)

        // Ghosting and a padlock are both ink a screen reader cannot hear.
        #expect(row.isReadOnly)
        #expect(row.announcement.contains("Read-only Session"))
    }

    /// The mark is narrower than the ghosting: an orphaned row is ghosted without one, because
    /// selecting it resumes the chain.
    @Test
    func `only a Session nobody can type into carries the lock`() {
        let rows = SessionRosterProjection.rows(
            from: [
                RosterSessionFixture.session(id: "managed", access: .managed),
                RosterSessionFixture.session(id: "external", access: .external),
                RosterSessionFixture.session(id: "orphaned", access: .orphaned),
            ],
        )

        #expect(rows.map(\.isReadOnly) == [false, true, true])
        // The symbol itself, not the token that names it: an assertion reading the same constant
        // the projection does cannot fail when the mark changes.
        #expect(rows.map(\.lock) == [nil, "lock", nil])
    }

    /// The rail and the deck's foot draw ONE mark for this posture. Asserted here because the two
    /// read the same token from opposite ends of the module and nothing else would catch a split.
    @Test
    func `the rail's padlock is the composer foot's own mark`() {
        #expect(ArgoSymbol.readOnlySession == SessionComposerProjection.Unavailable.external.mark)
    }

    @Test
    func `read-only Sessions carry no invented operational word`() throws {
        let row = try #require(rows(RosterSessionFixture.session(
            id: "external",
            access: .external,
            status: .unknown,
        )).first)

        #expect(row.stateWord == nil)
        #expect(row.state == nil)
    }

    private func rows(_ session: CockpitPresentation.Session) -> [SessionRosterProjection.Row] {
        SessionRosterProjection.rows(from: [session])
    }
}
