import ArgoEngine
@testable import ArgoUI
import Testing

/// A DERIVED title that names more than one row (#1567). `SessionTitle` contested only a Ticket's
/// words (#1072); the summary a CLI wrote had no matching rule, so a `-p` loop sending one prompt
/// template drew 197 rows carrying the same seven words and nothing told them apart.
///
/// The disambiguator is the time of day, because that is the honest one for a batch: its runs
/// differ by minutes and nothing else about them does.
@Suite("Colliding derived titles")
struct SessionTitleCollisionTests {
    private let loop = RosterFoldFixture.loop

    /// The fold's own runs as rows: opening it is the only way a reader ever sees them, and the
    /// naming group they contest is the fold's rather than the roster's.
    private func openedFold(
        of sessions: [CockpitPresentation.Session],
    )
        -> [SessionRosterProjection.Row] {
        let shut = SessionRosterProjection.rows(from: sessions)
        return SessionRosterProjection
            .rows(from: sessions, opened: Set(shut.compactMap(\.fold?.id)))
            .filter { $0.fold == nil }
    }

    /// The clock leads, and the summary follows it. The roster's title truncates at the tail, so
    /// a disambiguator behind a summary long enough to collide is clipped on every row that
    /// needed one — which is what the #1567 render showed.
    @Test
    func `a derived title two rows would draw takes each row's own clock`() {
        let rows = openedFold(of: RosterFoldFixture.runs(3, at: loop))

        #expect(rows.count == 3)
        #expect(Set(rows.map(\.title)).count == 3)
        #expect(rows.allSatisfy { $0.title.hasSuffix(" · Write the caption") })
        #expect(rows.allSatisfy { !$0.title.hasPrefix("Write the caption") })
    }

    /// One row drawing a summary is not a collision, and pays nothing for the rule.
    @Test
    func `a derived title only one row draws is left alone`() throws {
        let alone = RosterFoldFixture.run(at: loop, index: 0, startedAtMs: 8_000_000)

        let row = try #require(SessionRosterProjection.rows(from: [alone]).first)

        #expect(row.title == "Write the caption")
    }

    /// Degrade-down: a moment Argo never read is not a moment to spend. The rows stay alike
    /// rather than take an invented clock.
    @Test
    func `a run Argo read no start for keeps the bare summary`() {
        let unstamped = (0 ..< 2).map { RosterFoldFixture.run(at: loop, index: $0) }

        let rows = openedFold(of: unstamped)

        #expect(rows.map(\.title) == ["Write the caption", "Write the caption"])
    }

    /// The clock rides the DERIVED title alone. A Ticket's own sentence is already spent where it
    /// names one row (#1072), and an explicit name is the user's words, untouched.
    @Test
    func `a named row draws the name it was given`() throws {
        let named = RosterFoldFixture.run(at: loop, index: 0, startedAtMs: 8_000_000)
        let sessions = [
            RosterSessionFixture.session(
                id: named.id, title: named.title, workspaceLocation: loop,
                access: .external, entry: .headless, lastSeenAtMs: 9_000_000,
                startedAtMs: 8_000_000, explicitName: "The one I care about",
            ),
        ] + RosterFoldFixture.runs(2, at: loop, from: 100)

        let rows = openedFold(of: sessions)

        #expect(try #require(rows.first).title == "The one I care about")
    }
}
