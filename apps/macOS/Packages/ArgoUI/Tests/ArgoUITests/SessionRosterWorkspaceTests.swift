@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// What a roster row says about WHERE its Session is — the second line, and the two facts behind
/// it that the row no longer draws.
@Suite("Session roster workspace")
struct SessionRosterWorkspaceTests {
    private let checkout = RosterSessionFixture.checkout

    @Test
    func `the row's second line is the worktree its Session is in`() {
        // Two Sessions in one repo: the worktree is what tells them apart, and unlike the
        // branch it cannot move under the reader mid-scan.
        let rows = SessionRosterProjection.rows(from: [
            worktreeSession(id: "one", at: "\(checkout)/.claude/worktrees/tkt-505"),
            worktreeSession(id: "two", at: "\(checkout)/.claude/worktrees/tkt-509"),
        ])

        #expect(rows.map(\.worktree) == ["tkt-505", "tkt-509"])
    }

    @Test
    func `a Session in the Project's own checkout carries no second line`() throws {
        let row = try #require(SessionRosterProjection.rows(from: [
            RosterSessionFixture.session(id: "shared", kind: .main),
        ]).first)

        // Absent, not the folder's own name — every unisolated Session sits in that checkout.
        #expect(row.worktree == nil)
        #expect(!row.announcement.contains("argo"))
    }

    @Test
    func `a workspace whose kind Argo has not read carries no second line either`() throws {
        // The label is a claim that the folder IS a worktree. An unread kind cannot make it,
        // and `CONTEXT.md`'s degrade-down rule gives it the absent rendering, not the guess.
        let row = try #require(SessionRosterProjection.rows(from: [
            RosterSessionFixture.session(id: "unread", kind: nil),
        ]).first)

        #expect(row.worktree == nil)
    }

    @Test
    func `a Session with no cwd carries no second line rather than a word for one`() throws {
        let row = try #require(SessionRosterProjection.rows(from: [
            worktreeSession(id: "placeless", at: nil),
        ]).first)

        // Absent, not the roster's `unknown`: a placeholder reads as a folder nobody can find.
        #expect(row.worktree == nil)
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

        #expect(rows.map(\.worktree) == ["trees/tkt-537", "trees/tkt-537", "tkt-509"])
    }

    @Test
    func `a row that draws no label is no rival to the ones that do`() {
        // Dropped BEFORE the labels are decided: a silent row must not push the rows around it
        // into longer names to be told apart from something nobody can see.
        let rows = SessionRosterProjection.rows(from: [
            RosterSessionFixture.session(id: "shared", workspaceLocation: "/Users/milad/a/argo"),
            worktreeSession(id: "one", at: "/Users/milad/b/argo"),
        ])

        #expect(rows.map(\.worktree) == [nil, "argo"])
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
        // Copy-the-location and the row's tooltip still need the whole path.
        let sessions = [
            RosterSessionFixture.session(id: "one", workspaceLocation: "/Users/milad/Client/argo"),
            RosterSessionFixture.session(id: "two", workspaceLocation: nil),
        ]

        let rows = SessionRosterProjection.rows(from: sessions)

        #expect(rows.map(\.location) == sessions.map(\.workspaceLocation))
    }

    private func worktreeSession(id: String, at location: String?)
        -> CockpitPresentation.Session {
        RosterSessionFixture.session(id: id, workspaceLocation: location, kind: .worktree)
    }
}
