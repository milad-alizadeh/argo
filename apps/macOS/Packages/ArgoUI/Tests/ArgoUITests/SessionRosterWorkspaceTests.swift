@testable import ArgoUI
import Testing

/// What a roster row says about WHERE its Session is — the second line, and the two facts behind
/// it that the row no longer draws.
@Suite("Session roster workspace")
struct SessionRosterWorkspaceTests {
    private let main = rosterMainCheckout

    @Test
    func `the row's second line is the worktree its Session is in`() {
        // Two Sessions in one repo: the worktree is what tells them apart, and unlike the
        // branch it cannot move under the reader mid-scan.
        let rows = SessionRosterProjection.rows(
            from: [
                rosterSession(id: "one", workspaceLocation: "\(main)/.claude/worktrees/tkt-505"),
                rosterSession(id: "two", workspaceLocation: "\(main)/.claude/worktrees/tkt-509"),
            ],
            mainCheckout: main,
        )

        #expect(rows.map(\.worktree) == ["tkt-505", "tkt-509"])
    }

    @Test
    func `a Session in the shared main checkout carries no second line`() throws {
        let row = try #require(SessionRosterProjection.rows(
            from: [rosterSession(id: "shared", workspaceLocation: main)],
            mainCheckout: main,
        ).first)

        // Absent, not the folder's own name: the main checkout is where every unisolated
        // Session sits, so naming it on each row spends a line on a constant.
        #expect(row.worktree == nil)
        #expect(!row.announcement.contains("argo"))
    }

    @Test
    func `a trailing slash on either path is the same checkout`() throws {
        let row = try #require(SessionRosterProjection.rows(
            from: [rosterSession(id: "shared", workspaceLocation: "\(main)/")],
            mainCheckout: main,
        ).first)

        // A path is compared as a path. Two spellings of one folder reading as two would put
        // the main checkout's own name back on the row it was taken off.
        #expect(row.worktree == nil)
    }

    @Test
    func `a Session with no cwd carries no second line rather than a word for one`() throws {
        let row = try #require(SessionRosterProjection.rows(from: [
            rosterSession(id: "placeless", workspaceLocation: nil),
        ]).first)

        // Absent, not the roster's `unknown`: a Session whose record never said where it ran
        // has nothing to say here, and a placeholder would read as a folder nobody can find.
        #expect(row.worktree == nil)
    }

    @Test
    func `two worktrees with the same leaf name still read apart`() {
        // The leaf alone is the label wherever it is unambiguous; where two Projects hold a
        // worktree of one name, the nearest distinguishing parent joins it.
        let rows = SessionRosterProjection.rows(
            from: [
                rosterSession(id: "one", workspaceLocation: "/Users/milad/argo/trees/tkt-537"),
                rosterSession(id: "two", workspaceLocation: "/Users/milad/cockpit/trees/tkt-537"),
                rosterSession(id: "three", workspaceLocation: "/Users/milad/argo/trees/tkt-509"),
            ],
            mainCheckout: main,
        )

        #expect(rows.map(\.worktree) == ["trees/tkt-537", "trees/tkt-537", "tkt-509"])
    }

    @Test
    func `the shared checkout is no rival to the worktrees it holds`() {
        // Dropped BEFORE the labels are drawn: a silent row must not push the rows around it
        // into longer names to be told apart from something nobody can see.
        let rows = SessionRosterProjection.rows(
            from: [
                rosterSession(id: "shared", workspaceLocation: "/Users/milad/trees/argo"),
                rosterSession(id: "one", workspaceLocation: "/Users/milad/worktrees/argo"),
            ],
            mainCheckout: "/Users/milad/trees/argo",
        )

        #expect(rows.map(\.worktree) == [nil, "argo"])
    }

    @Test
    func `the branch survives the row for the copy action, and is never announced`() throws {
        // It moved to the session header, where there is room to name it. The row keeps it for
        // the same reason it keeps the full location: dropping the line is a rendering
        // decision, not a data one.
        let row = try #require(SessionRosterProjection.rows(
            from: [rosterSession(id: "one", branch: "argo/#537-session-rail-worktree")],
            mainCheckout: main,
        ).first)

        #expect(row.branch == "argo/#537-session-rail-worktree")
        #expect(!row.announcement.contains("argo/#537-session-rail-worktree"))
    }

    @Test
    func `the full location survives the row even though it never draws on it`() {
        // The line is a label, but copy-the-location and the row's tooltip still need the whole
        // path — dropping the workspace identity is a rendering decision, not a data one.
        let sessions = [
            rosterSession(id: "one", workspaceLocation: "/Users/milad/Client/argo"),
            rosterSession(id: "two", workspaceLocation: nil),
        ]

        let rows = SessionRosterProjection.rows(from: sessions)

        #expect(rows.map(\.location) == sessions.map(\.workspaceLocation))
    }
}
