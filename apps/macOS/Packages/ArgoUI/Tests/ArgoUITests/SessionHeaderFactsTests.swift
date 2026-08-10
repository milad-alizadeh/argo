import ArgoEngine
@testable import ArgoUI
import Testing

@Suite("Session header — the Workspace, the CLI and the issue")
struct SessionHeaderFactsTests {
    @Test
    func `the branch is carried whole, and cutting it is the view's business`() {
        let header = header(workspace: .init(branch: "worktree-ticket-375-graphite-ion-blue"))

        // Verbatim and uncut: how much of a name fits is a WIDTH, and a projection that
        // ellipsized would have decided that for every width at once.
        #expect(header.branch == "worktree-ticket-375-graphite-ion-blue")
    }

    @Test
    func `a Session that has not branched shows no branch`() {
        #expect(header(workspace: nil).branch == nil)
        #expect(header(workspace: .init(branch: nil)).branch == nil)
    }

    @Test
    func `only a worktree is marked as one`() {
        let worktree = header(workspace: .init(kind: .worktree, branch: "argo/#510"))
        let main = header(workspace: .init(kind: .main, branch: "main"))
        let unread = header(workspace: .init(kind: nil, branch: "main"))

        // The Project's own checkout is where a Session is unless something says otherwise, so
        // it spends no ink — and a kind nobody has read is not a claim that it is the main one.
        #expect(worktree.marks.map(\.symbol) == [ArgoSymbol.worktree])
        #expect(worktree.marks.first?.count == nil)
        #expect(main.marks.isEmpty)
        #expect(unread.marks.isEmpty)
    }

    @Test
    func `the git counts are drawn as marks that spell themselves out`() throws {
        let header = header(workspace: .init(branch: "main", dirty: 3, unpushed: 1))

        // A glyph and a count need no key — but a glyph is ink, so the sentence travels with it
        // for the tooltip and for anything that has to say the row out loud.
        #expect(header.marks.map(\.symbol) == [ArgoSymbol.uncommitted, ArgoSymbol.unpushed])
        #expect(header.marks.map(\.count) == [3, 1])
        #expect(header.marks.map(\.detail) == ["3 uncommitted files", "1 unpushed commit"])
        try #require(header.announcement.contains("3 uncommitted files"))
    }

    @Test
    func `a count of zero and a count nobody read both draw nothing`() {
        let clean = header(workspace: .init(branch: "main", dirty: 0, unpushed: 0))
        let unread = header(workspace: .init(branch: "main", dirty: nil, unpushed: nil))

        // `•0` is a count drawn over an answer worth nothing: there is nothing to see either
        // way, and a mark claims there is.
        #expect(clean.marks.isEmpty)
        #expect(unread.marks.isEmpty)
    }

    @Test
    func `the header says the CLI and a readable model name`() {
        #expect(header(cli: .claude, model: "claude-opus-5").agent == "Claude Code · Opus 5")
    }

    @Test
    func `a model id the table does not know renders verbatim`() {
        // Ugly-but-true beats invisible and beats the nearest guess: a model released this
        // morning is still what this Session is running.
        #expect(header(cli: .claude, model: "gpt-9-turbo").agent == "Claude Code · gpt-9-turbo")
        #expect(header(cli: nil, model: "some-unreleased-model").agent == "some-unreleased-model")
    }

    @Test
    func `a pinned snapshot still reads as the model it is a snapshot of`() {
        // The date a provider pins a snapshot with is not a different model, and a table
        // carrying every snapshot of every model would be stale the day after each one ships.
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
        // The issue's own words, read through and never reworded — and absent rather than
        // invented for a provider that gave none.
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
            issue: .init(number: 510, title: "The header carries the Session's facts"),
        )

        // A glyph is nothing a screen reader can hear, so each mark says what it COUNTS — and
        // says it once, in the same order the header draws it.
        #expect(header.announcement == [
            "Session",
            "on argo/#510",
            "In a worktree of its own",
            "2 uncommitted files",
            "1 unpushed commit",
            "Claude Code · Opus 5",
            "Issue #510",
        ].joined(separator: ", "))
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
