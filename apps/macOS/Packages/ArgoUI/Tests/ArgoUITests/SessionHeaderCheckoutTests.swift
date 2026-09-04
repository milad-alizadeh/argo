import ArgoDesign
import ArgoEngine
@testable import ArgoUI
import Testing

/// What the header says about the Session's CHECKOUT — the branch, the glyph that says which kind
/// of checkout it is, and the worktree folder the roster row stopped naming (#1199).
///
/// Its own suite because the checkout is now the header's largest single subject: the roster row
/// used to carry half of it, so this is the only surface that says which folder a Session runs in.
@Suite("Session header checkout")
struct SessionHeaderCheckoutTests {
    @Test
    func `the branch is carried whole, and cutting it is the view's business`() {
        let header = header(workspace: .init(branch: "worktree-ticket-375-graphite-ion-blue"))

        #expect(header.checkout?.branch == "worktree-ticket-375-graphite-ion-blue")
    }

    @Test
    func `a Session that has not branched shows no checkout at all`() {
        // Not a checkout with an empty name, and not a lone glyph.
        #expect(header(workspace: nil).checkout == nil)
        #expect(header(workspace: .init(branch: nil)).checkout == nil)
        #expect(header(workspace: .init(kind: .worktree, branch: nil)).checkout == nil)
    }

    @Test
    func `a worktree is marked by the branch's own glyph, not by a mark after it`() {
        let worktree = header(workspace: .init(kind: .worktree, branch: "argo/#510"))
        let main = header(workspace: .init(kind: .main, branch: "main"))

        #expect(worktree.checkout?.symbol == ArgoSymbol.worktree)
        #expect(worktree.marks.isEmpty)
        #expect(main.checkout?.symbol == ArgoSymbol.branch)
    }

    @Test
    func `a checkout nobody has read draws no mark, rather than the one meaning not-a-worktree`() {
        let unread = header(workspace: .init(kind: nil, branch: "main"))

        // The glyph is the ONLY thing telling the two kinds apart now, so the plain branch mark
        // is a positive claim — and Argo has not read the kind. The degrade-down rule gives an
        // unestablished fact an absent rendering, never the nearest guess (`CONTEXT.md`).
        #expect(unread.checkout?.symbol == nil)
        // Still a checkout, though: the BRANCH was read.
        #expect(unread.checkout?.branch == "main")
    }

    @Test
    func `the checkout says which kind it is in words as well as in ink`() throws {
        // The kind Argo could not read says nothing about a kind, in words either.
        let worktree = header(
            workspace: .init(kind: .worktree, branch: "argo/#510"),
            location: "/Users/milad/Developer/argo/.claude/worktrees/tkt-510",
        )
        let main = header(workspace: .init(kind: .main, branch: "main"))
        let unread = header(workspace: .init(kind: nil, branch: "main"))

        // The folder as well as the branch (#1199): the roster row no longer names it, so this
        // is the only place a reader can learn which checkout the Session is in.
        #expect(try #require(worktree.checkout).detail == "On argo/#510, in the worktree tkt-510")
        #expect(try #require(worktree.checkout).worktree == "tkt-510")
        #expect(try #require(main.checkout).detail == "On main, in the Project's own checkout")
        #expect(try #require(unread.checkout).detail == "On main")
        // Neither of the two that is not a worktree names one.
        #expect(try #require(main.checkout).worktree == nil)
        #expect(try #require(unread.checkout).worktree == nil)
    }

    @Test
    func `a worktree the branch already names is not named twice`() throws {
        // The common shape on this machine: the folder IS the branch. Repeating it would spend
        // the line's width on a word the reader has just read.
        let named = header(
            workspace: .init(kind: .worktree, branch: "ticket-1199-roster-activity"),
            location: "/Users/milad/Developer/argo/.claude/worktrees/ticket-1199-roster-activity",
        )

        #expect(try #require(named.checkout).worktree == nil)
        #expect(
            try #require(named.checkout).detail
                == "On ticket-1199-roster-activity, in a worktree of its own",
        )
    }

    @Test
    func `a worktree Argo read no location for still says it is one`() throws {
        // Degrade-down: the KIND was read, so the sentence keeps its claim; only the folder,
        // which nothing could name, goes.
        let placeless = header(
            workspace: .init(kind: .worktree, branch: "argo/#510"), location: "",
        )

        #expect(try #require(placeless.checkout).worktree == nil)
        #expect(try #require(placeless.checkout).detail == "On argo/#510, in a worktree of its own")
    }

    private func header(
        workspace: CockpitPresentation.Session.Workspace?,
        location: String = "/Users/milad/Developer/argo",
    )
        -> SessionHeaderProjection.Header {
        SessionHeaderProjection.header(from: CockpitPresentation.Session(
            id: "session",
            title: "Session",
            access: .managed,
            status: .idle,
            chain: .init(program: .init(cli: .claude, model: "claude-opus-5")),
            work: .init(location: location, workspace: workspace),
        ))
    }
}
