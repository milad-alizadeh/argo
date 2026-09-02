import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// The Roster's folds (`CONTEXT.md` "Not domain entities" · Fold): one row standing for the
/// headless runs that share a working directory, and what that row says.
///
/// The measurement behind it (#1073): the argo Project's 7-day working set held 328 transcripts,
/// at least 136 of them headless, and one caption loop's 180 runs buried the four Sessions
/// somebody was actually steering. The rules about what may NOT be folded are their own suite —
/// `SessionRosterFoldRulesTests`.
@Suite("Session roster folds")
struct SessionRosterFoldTests {
    private let loop = RosterFoldFixture.loop

    private func runs(
        _ count: Int, at directory: String?, from first: Int = 0,
    )
        -> [CockpitPresentation.Session] {
        RosterFoldFixture.runs(count, at: directory, from: first)
    }

    @Test
    func `the headless runs of one directory draw a single row`() throws {
        let rows = SessionRosterProjection.rows(from: runs(180, at: loop))

        let fold = try #require(rows.first)
        #expect(rows.count == 1)
        #expect(fold.title == "180 runs")
        // The directory, in the slot the roster tells rows apart by — the label #1072's title
        // pass could not supply, because 180 near-identical prompts share their first words.
        #expect(fold.toldApart == "prototypes")
        #expect(fold.fold?.count == 180)
    }

    @Test
    func `a lone headless run keeps its own row`() throws {
        // A fold of one saves no row and costs a name.
        let row = try #require(SessionRosterProjection.rows(from: runs(1, at: loop)).first)

        #expect(row.fold == nil)
        #expect(row.title == "Write the caption")
    }

    /// The mixed directory, stated: the fold takes the headless runs and NOTHING else. The
    /// interactive Sessions beside them keep their own rows and are not in the count.
    @Test
    func `a directory holding both folds only the runs nobody is at`() throws {
        let sessions = runs(3, at: loop)
            + RosterFoldFixture.runs(2, at: loop, entry: .interactive, from: 100)

        let rows = SessionRosterProjection.rows(from: sessions)

        #expect(rows.count == 3)
        let fold = try #require(rows.first)
        #expect(fold.fold?.count == 3)
        #expect(rows.dropFirst().allSatisfy { $0.fold == nil })
        #expect(rows.dropFirst().map(\.id) == ["run-100", "run-101"])
    }

    @Test
    func `runs in two directories fold apart, each named by its own folder`() {
        let rows = SessionRosterProjection.rows(
            from: runs(4, at: loop) + runs(3, at: RosterFoldFixture.otherLoop, from: 100),
        )

        #expect(rows.map(\.title) == ["4 runs", "3 runs"])
        #expect(rows.map(\.toldApart) == ["prototypes", "captions"])
    }

    /// The fold sits where its newest run sat, so nothing above or below it moves when a
    /// directory folds.
    @Test
    func `a fold takes the place its newest run had`() {
        let steered = RosterSessionFixture.session(id: "steered", lastSeenAtMs: 9_500_000)
        let older = RosterSessionFixture.session(id: "older", lastSeenAtMs: 1)

        let rows = SessionRosterProjection.rows(from: [steered] + runs(3, at: loop) + [older])

        #expect(rows.map(\.id).first == "steered")
        #expect(rows.map(\.id).last == "older")
        #expect(rows.count == 3)
    }

    /// What keeps a headless run that FAILED reachable, which is the whole reason the Roster folds
    /// these rows rather than dropping them: opening the fold draws them as ordinary rows.
    @Test
    func `opening a fold draws its runs underneath it`() throws {
        let sessions = runs(3, at: loop)
        let shut = try #require(SessionRosterProjection.rows(from: sessions).first)

        let rows = SessionRosterProjection.rows(from: sessions, opened: [shut.id])

        #expect(rows.count == 4)
        #expect(rows.first?.fold?.isOpen == true)
        #expect(rows.dropFirst().map(\.id) == ["run-0", "run-1", "run-2"])
        #expect(rows.dropFirst().allSatisfy { $0.fold == nil })
    }

    /// A fold is not a Session, so nothing may address one as if it were: the deck renders what
    /// the selection names, and a fold names no transcript.
    @Test
    func `a fold's id is never a Session's`() throws {
        let sessions = runs(3, at: loop)

        let fold = try #require(SessionRosterProjection.rows(from: sessions).first)

        #expect(!sessions.map(\.id).contains(fold.id))
        // And nothing can be typed into it, which is what the row is drawn as.
        #expect(fold.isReadOnly)
        #expect(fold.rename == nil)
    }

    @Test
    func `a fold says how many runs it stands for, and whether it is open`() throws {
        let sessions = runs(2, at: loop)
        let shut = try #require(SessionRosterProjection.rows(from: sessions).first)

        #expect(shut.announcement.contains("2 runs"))
        #expect(shut.announcement.contains("Collapsed"))
        #expect(shut.announcement.contains("Headless runs"))

        let open = try #require(
            SessionRosterProjection.rows(from: sessions, opened: [shut.id]).first,
        )
        #expect(open.announcement.contains("Expanded"))
    }

    /// The archive is the same rows by the same rules — a Session put out of sight is not a
    /// Session described differently.
    @Test
    func `the archived list folds by the same rule`() {
        let archived = (0 ..< 3)
            .map { RosterFoldFixture.run(at: loop, index: $0, isArchived: true) }

        #expect(SessionRosterProjection.archivedRows(from: archived).count == 1)
        #expect(SessionRosterProjection.rows(from: archived).isEmpty)
    }
}
