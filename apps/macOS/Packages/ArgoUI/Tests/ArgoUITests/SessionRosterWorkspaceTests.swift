@testable import ArgoUI
import Testing

/// What a roster row says about WHERE its Session is — spoken, since #1199 took the worktree chip
/// off the row, and the two facts behind it that the row has never drawn.
@Suite("Session roster workspace")
struct SessionRosterWorkspaceTests {
    private let checkout = RosterSessionFixture.checkout

    @Test
    func `a row names the worktree its Session is in to a screen reader`() {
        // Two Sessions in one repo: the worktree is what tells them apart, and unlike the
        // branch it cannot move under the reader mid-scan. Spoken and not drawn — the row's ink
        // goes on what the Session is doing, and the header names the checkout.
        let rows = SessionRosterProjection.rows(from: [
            worktreeSession(id: "one", at: "\(checkout)/.claude/worktrees/tkt-505"),
            worktreeSession(id: "two", at: "\(checkout)/.claude/worktrees/tkt-509"),
        ])

        #expect(rows.map(spokenWorktree) == ["tkt-505", "tkt-509"])
    }

    @Test
    func `a Session in the Project's own checkout names no worktree`() throws {
        let row = try #require(SessionRosterProjection.rows(from: [
            RosterSessionFixture.session(id: "shared", kind: .main),
        ]).first)

        // Absent, not the folder's own name — every unisolated Session sits in that checkout.
        #expect(spokenWorktree(row) == nil)
        #expect(!row.announcement.contains("argo"))
    }

    @Test
    func `a workspace whose kind Argo has not read names no worktree either`() throws {
        // The label is a claim that the folder IS a worktree. An unread kind cannot make it,
        // and `CONTEXT.md`'s degrade-down rule gives it the absent rendering, not the guess.
        let row = try #require(SessionRosterProjection.rows(from: [
            RosterSessionFixture.session(id: "unread", kind: nil),
        ]).first)

        #expect(spokenWorktree(row) == nil)
    }

    @Test
    func `a Session with no cwd names no worktree rather than a word for one`() throws {
        let row = try #require(SessionRosterProjection.rows(from: [
            worktreeSession(id: "placeless", at: nil),
        ]).first)

        // Absent, not the roster's `unknown`: a placeholder reads as a folder nobody can find.
        #expect(spokenWorktree(row) == nil)
    }

    @Test
    func `two worktrees with the same leaf name still read apart`() {
        // The leaf alone is the label wherever it is unambiguous; where two Projects hold a
        // worktree of one name, the nearest distinguishing parent joins it.
        let rows = SessionRosterProjection.rows(from: [
            worktreeSession(id: "one", at: "/Users/milad/argo/trees/tkt-537"),
            worktreeSession(id: "two", at: "/Users/milad/cockpit/trees/tkt-537"),
            worktreeSession(id: "three", at: "/Users/milad/argo/trees/tkt-509"),
        ])

        #expect(rows.map(spokenWorktree) == ["trees/tkt-537", "trees/tkt-537", "tkt-509"])
    }

    @Test
    func `a row that names no worktree is no rival to the ones that do`() {
        // Dropped BEFORE the labels are decided: a silent row must not push the rows around it
        // into longer names to be told apart from something nobody can see.
        let rows = SessionRosterProjection.rows(from: [
            RosterSessionFixture.session(id: "shared", workspaceLocation: "/Users/milad/a/argo"),
            worktreeSession(id: "one", at: "/Users/milad/b/argo"),
        ])

        #expect(rows.map(spokenWorktree) == [nil, "argo"])
    }

    @Test
    func `the worktree is the one fact a row says and never draws`() throws {
        // The chip left the row (#1199) without taking the fact with it: a listener still hears
        // which folder the Session is in, and the second line has nothing on it at all.
        let row = try #require(SessionRosterProjection.rows(from: [
            worktreeSession(id: "one", at: "\(checkout)/.claude/worktrees/tkt-505"),
        ]).first)

        #expect(spokenWorktree(row) == "tkt-505")
        #expect(row.secondaryFact == nil)
        #expect(row.clock == nil)
    }

    @Test
    func `the branch survives the row for the copy action, and is never announced`() throws {
        // Dropping the line is a rendering decision, not a data one.
        let row = try #require(SessionRosterProjection.rows(from: [
            RosterSessionFixture.session(id: "one", branch: "argo/#537-session-rail-worktree"),
        ]).first)

        #expect(row.branch == "argo/#537-session-rail-worktree")
        #expect(!row.announcement.contains("argo/#537-session-rail-worktree"))
    }

    @Test
    func `the full location survives the row even though it never draws on it`() {
        // Copy-the-location still needs the whole path; the hover no longer shows it.
        let sessions = [
            RosterSessionFixture.session(id: "one", workspaceLocation: "/Users/milad/Client/argo"),
            RosterSessionFixture.session(id: "two", workspaceLocation: nil),
        ]

        let rows = SessionRosterProjection.rows(from: sessions)

        #expect(rows.map(\.location) == sessions.map(\.workspaceLocation))
    }

    /// The worktree as the row SAYS it, read back off the one place it appears. The row holds it
    /// privately, because a slot nothing draws is a slot no surface should be able to reach.
    private func spokenWorktree(_ row: SessionRosterProjection.Row) -> String? {
        row.announcement
            .split(separator: ", ")
            .first { $0.hasPrefix("in ") }
            .map { String($0.dropFirst("in ".count)) }
    }

    private func worktreeSession(id: String, at location: String?)
        -> CockpitPresentation.Session {
        RosterSessionFixture.session(id: id, workspaceLocation: location, kind: .worktree)
    }
}
