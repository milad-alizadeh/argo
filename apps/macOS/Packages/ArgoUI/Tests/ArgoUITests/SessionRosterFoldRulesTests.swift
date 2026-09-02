import ArgoEngine
@testable import ArgoUI
import Testing

/// What the Roster may NOT fold, and when a fold opens itself. Every rule here is degrade-down
/// (`CONTEXT.md` Honesty tier): each one resolves a doubt toward the row staying reachable.
@Suite("Session roster fold rules")
struct SessionRosterFoldRulesTests {
    private let loop = RosterFoldFixture.loop

    private func runs(
        _ count: Int, at directory: String?, entry: SessionEntry = .headless,
    )
        -> [CockpitPresentation.Session] {
        RosterFoldFixture.runs(count, at: directory, entry: entry)
    }

    /// The rule that matters most, and the one degrade-down exists for: a Session somebody is
    /// driving is never folded away, whatever it is sitting beside.
    @Test
    func `interactive Sessions are never folded, however many share a directory`() {
        let rows = SessionRosterProjection.rows(from: runs(3, at: loop, entry: .interactive))

        #expect(rows.count == 3)
        #expect(rows.allSatisfy { $0.fold == nil })
    }

    /// A fold has no folder to be keyed by, so there is nothing to fold into.
    @Test
    func `runs Argo read no working directory for are never folded`() {
        let rows = SessionRosterProjection.rows(from: runs(3, at: nil))

        #expect(rows.count == 3)
    }

    /// The pair of answers a fold gives — "this row opens a fold" and "this Session draws its own
    /// row" — are settled together, so a directory that cannot fold keeps its rows rather than
    /// falling between them. A path with no component to name it by is the case that finds it.
    @Test
    func `runs in a folder with no name to fold under keep their own rows`() {
        let rows = SessionRosterProjection.rows(from: runs(3, at: "/"))

        #expect(rows.count == 3)
        #expect(rows.allSatisfy { $0.fold == nil })
    }

    /// Argo owns the terminal of a managed Session, so it can be typed at whatever its record said
    /// it was started as — and a Session anybody can drive is never folded away (degrade-down).
    @Test
    func `a Session Argo owns the terminal of is never folded`() {
        let driven = (0 ..< 3).map {
            RosterFoldFixture.run(at: loop, index: $0, access: .managed)
        }

        #expect(SessionRosterProjection.rows(from: driven).count == 3)
    }

    /// One directory with runs on both lists is two rows, and opening either may not open the
    /// other: the id names the list as well as the folder.
    @Test
    func `a fold on the roster and one in the archive do not share an id`() throws {
        let kept = runs(2, at: loop)
        let archived = (0 ..< 2).map {
            RosterFoldFixture.run(at: loop, index: 100 + $0, isArchived: true)
        }
        let sessions = kept + archived

        let onRoster = try #require(SessionRosterProjection.rows(from: sessions).first)
        let behindFoot = try #require(
            SessionRosterProjection.archivedRows(from: sessions).first,
        )

        #expect(onRoster.id != behindFoot.id)
        // Opening the archived one leaves the roster's shut.
        let rows = SessionRosterProjection.rows(from: sessions, opened: [behindFoot.id])
        #expect(rows.count == 1)
        #expect(rows.first?.fold?.isOpen == false)
    }

    /// The deck draws whatever the selection names, so a fold shut over the selected run would
    /// leave the roster drawing no row for the Session the feed is drawing — the state
    /// `isArchiveOpen` refuses for the archive, refused here for the same reason.
    @Test
    func `a fold holding the selection is open whether or not the reader opened it`() throws {
        let rows = SessionRosterProjection.rows(from: runs(3, at: loop), selection: "run-1")

        #expect(rows.count == 4)
        #expect(try #require(rows.first).fold?.isOpen == true)
        #expect(rows.map(\.id).contains("run-1"))
    }
}
