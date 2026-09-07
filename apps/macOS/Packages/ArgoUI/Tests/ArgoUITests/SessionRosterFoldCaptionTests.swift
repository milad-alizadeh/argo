import ArgoEngine
@testable import ArgoUI
import Testing

/// What a fold's row SAYS (#1567). The fold exists to keep a headless Session that failed
/// reachable, and a caption that counted was the one fact its reader did not need: they can see
/// it is a lot, and they could not see that three of them had failed without opening it and
/// scanning the dots.
@Suite("Session roster fold captions")
struct SessionRosterFoldCaptionTests {
    private let loop = RosterFoldFixture.loop

    @Test
    func `a fold with nothing failed spends no failure clause`() throws {
        let rows = SessionRosterProjection.rows(from: RosterFoldFixture.runs(3, at: loop))

        // No `· 0 failed`: the reader then never opens a fold that has nothing in it for them.
        #expect(try #require(rows.first).title == "3 Sessions")
    }

    @Test
    func `a fold says how many of the Sessions it hides failed`() throws {
        let sessions = RosterFoldFixture.runs(2, at: loop)
            + RosterFoldFixture.runs(1, at: loop, from: 100, status: .stopped)

        let rows = SessionRosterProjection.rows(from: sessions)

        #expect(try #require(rows.first).title == "3 Sessions · 1 failed")
    }

    /// The clause counts the failure ROLE, not one status word: whatever else reaches
    /// `.failure` reaches the caption with it, and no second table can drift from
    /// `SessionState.role(for:)`.
    @Test
    func `the failure count is the dots the fold hides`() throws {
        let failing = SessionStatus.allCases
            .filter { SessionState.role(for: $0) == .failure }
        let sessions = failing.enumerated().flatMap { index, status in
            RosterFoldFixture.runs(1, at: loop, from: index, status: status)
        } + RosterFoldFixture.runs(2, at: loop, from: 100)

        let rows = SessionRosterProjection.rows(from: sessions)

        #expect(try #require(rows.first)
            .title == "\(failing.count + 2) Sessions · \(failing.count) failed")
    }

    /// Each fold counts its OWN directory. A failure in one loop is not a claim about the other.
    @Test
    func `a failure in one fold is not counted in the other`() {
        let sessions = RosterFoldFixture.runs(2, at: loop, status: .stopped)
            + RosterFoldFixture.runs(3, at: RosterFoldFixture.otherLoop, from: 100)

        let rows = SessionRosterProjection.rows(from: sessions)

        #expect(rows.map(\.title) == ["2 Sessions · 2 failed", "3 Sessions"])
    }

    /// `run` is not a word the model defines: `docs/domain/` has Session, Turn, Ticket and
    /// Workspace, and the roster asked its reader to learn a second noun for Session on the one
    /// row that cannot be opened into a deck to find out what it meant.
    @Test
    func `the caption never spends the word runs`() throws {
        let failing = RosterFoldFixture.runs(2, at: loop, status: .stopped)

        let rows = SessionRosterProjection.rows(from: failing)

        #expect(try !(#require(rows.first).title.contains("runs")))
    }

    /// Both of the caption's numbers come off ONE array. Counting the Sessions from the fold's own
    /// pooled reading and the failures from the rows would read `197 Sessions · 2 failed` the
    /// moment those two sets differed — the one false claim a fold captioned by its failures
    /// cannot be allowed to make.
    @Test
    func `the caption counts the same Sessions the opened fold draws`() throws {
        let sessions = RosterFoldFixture.runs(4, at: loop)
            + RosterFoldFixture.runs(2, at: loop, from: 100, status: .stopped)

        let shut = SessionRosterProjection.rows(from: sessions)
        let opened = SessionRosterProjection
            .rows(from: sessions, opened: Set(shut.compactMap(\.fold?.id)))
            .filter { $0.fold == nil }
        let failed = opened.count { $0.state == .failure }

        #expect(try #require(shut.first)
            .title == "\(opened.count) Sessions · \(failed) failed")
    }
}
