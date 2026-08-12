import ArgoEngine
@testable import ArgoUI
import Testing

/// These are the PROJECTION's facts, not the fact line's. The line they were drawn on is gone
/// (#692) and they now reach the reader through the titlebar title's hover and the announcement,
/// so what they pin — the branch carried whole, an unread kind drawing nothing, a count of zero
/// drawing nothing — is unchanged by the move.
@Suite("Session header — the Workspace, the CLI and the issue")
struct SessionHeaderFactsTests {
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
        let worktree = header(workspace: .init(kind: .worktree, branch: "argo/#510"))
        let main = header(workspace: .init(kind: .main, branch: "main"))
        let unread = header(workspace: .init(kind: nil, branch: "main"))

        #expect(try #require(worktree.checkout).detail == "On argo/#510, in a worktree of its own")
        #expect(try #require(main.checkout).detail == "On main, in the Project's own checkout")
        #expect(try #require(unread.checkout).detail == "On main")
    }

    @Test
    func `the git counts are drawn as marks that spell themselves out`() throws {
        let header = header(workspace: .init(branch: "main", dirty: 3, unpushed: 1))

        #expect(header.marks.map(\.symbol) == [ArgoSymbol.uncommitted, ArgoSymbol.unpushed])
        #expect(header.marks.map(\.count) == [3, 1])
        #expect(header.marks.map(\.detail) == ["3 uncommitted files", "1 unpushed commit"])
        try #require(header.announcement.contains("3 uncommitted files"))
    }

    @Test
    func `a count of zero and a count nobody read both draw nothing`() {
        let clean = header(workspace: .init(branch: "main", dirty: 0, unpushed: 0))
        let unread = header(workspace: .init(branch: "main", dirty: nil, unpushed: nil))

        // `•0` is a mark claiming there is something to see.
        #expect(clean.marks.isEmpty)
        #expect(unread.marks.isEmpty)
    }

    @Test
    func `the header says the CLI and a readable model name`() {
        #expect(header(cli: .claude, model: "claude-opus-5").agent == "Claude Code · Opus 5")
    }

    @Test
    func `a model id the table does not know renders verbatim`() {
        // A model released this morning is still what this Session is running.
        #expect(header(cli: .claude, model: "gpt-9-turbo").agent == "Claude Code · gpt-9-turbo")
        #expect(header(cli: nil, model: "some-unreleased-model").agent == "some-unreleased-model")
    }

    @Test
    func `a pinned snapshot still reads as the model it is a snapshot of`() {
        // The date a provider pins a snapshot with is not a different model.
        #expect(header(cli: nil, model: "claude-opus-4-1-20250805").agent == "Opus 4.1")
        // Eight digits after a hyphen, and nothing else: a name that merely ENDS in a number
        // keeps it.
        #expect(header(cli: nil, model: "claude-opus-4-5").agent == "Opus 4.5")
        #expect(header(cli: nil, model: "mystery-1234").agent == "mystery-1234")
    }

    @Test
    func `a Session whose record named neither CLI nor model says nothing about either`() {
        // Rather than `Unknown · Unknown`, which is Argo inventing two facts to fill a line.
        #expect(header(cli: nil, model: nil).agent == nil)
    }

    @Test
    func `a linked issue is named, never left as a bare number`() throws {
        let linked = header(issue: .init(number: 400, title: "The Session header"))

        let issue = try #require(linked.issue)
        #expect(issue.label == "Issue #400")
        // Read through verbatim, and absent rather than invented for a provider that gave none.
        #expect(issue.detail == "The Session header")
        #expect(header(issue: .init(number: 400)).issue?.detail == nil)
    }

    @Test
    func `with no Work Item provider connected there is no ticket on the header at all`() {
        // Not an empty affordance, not an "attach" control: asserting a link to a provider that
        // does not exist is worse than no link (`CONTEXT.md` L1, and #502's Out of Scope).
        let header = header(issue: nil)

        #expect(header.issue == nil)
        #expect(!header.announcement.contains("Issue"))
    }

    @Test
    func `what the header announces carries every fact it draws`() {
        let header = header(
            cli: .claude,
            model: "claude-opus-5",
            workspace: .init(kind: .worktree, branch: "argo/#510", dirty: 2, unpushed: 1),
            // Untitled: a Work Item's title is a title SOURCE, and the chain has its own suite.
            issue: .init(number: 510),
        )

        // Each mark says what it COUNTS, once, in the same order the header draws it.
        #expect(header.announcement == [
            "Session",
            "Claude Code · Opus 5",
            "Issue #510",
            "On argo/#510, in a worktree of its own",
            "2 uncommitted files",
            "1 unpushed commit",
        ].joined(separator: ", "))
    }

    @Test
    func `the access mark is announced last, where the header draws it`() {
        // What a screen reader hears has to be the order the line is written in.
        let header = SessionHeaderProjection.header(from: CockpitPresentation.Session(
            id: "session",
            title: "Session",
            model: "claude-opus-5",
            workspaceLocation: "/Users/milad/Developer/argo",
            access: .orphaned,
            status: .idle,
            cli: .claude,
            workspace: .init(branch: "main"),
        ))

        #expect(header.announcement.hasSuffix("On main, Orphaned"))
    }

    private func header(
        cli: AgentCLI? = .claude,
        model: String? = "claude-opus-5",
        workspace: CockpitPresentation.Session.Workspace? = .init(branch: "main"),
        issue: CockpitPresentation.Session.Issue? = nil,
    )
        -> SessionHeaderProjection.Header {
        SessionHeaderProjection.header(from: CockpitPresentation.Session(
            id: "session",
            title: "Session",
            model: model,
            workspaceLocation: "/Users/milad/Developer/argo",
            access: .managed,
            status: .idle,
            cli: cli,
            workspace: workspace,
            issue: issue,
        ))
    }
}
