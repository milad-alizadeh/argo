import ArgoDesign
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
    func `the header says the CLI, and the CLI alone`() {
        #expect(header(cli: .claude, model: "claude-opus-5").agent == "Claude Code")
    }

    /// The model came off this line in #558, when Model and Effort became things the composer SETS
    /// — a value stated in two places is one you keep in sync by eye, and the composer is the place
    /// a reader can act on it (design decision 2). The readable-name rules the assertions above
    /// used to make are still made, in `SessionComposerProjectionTests`, where the fact now lives.
    @Test
    func `the model is not repeated here, whatever the record named`() {
        #expect(header(cli: .claude, model: "claude-opus-5").agent == "Claude Code")
        #expect(header(cli: .claude, model: "gpt-9-turbo").agent == "Claude Code")
        #expect(header(cli: .claude, model: nil).agent == "Claude Code")
    }

    @Test
    func `a Session whose record named no CLI says nothing`() {
        // Rather than `Unknown`, which is Argo inventing a fact to fill a line.
        #expect(header(cli: nil, model: "claude-opus-5").agent == nil)
        #expect(header(cli: nil, model: nil).agent == nil)
    }

    /// Bound, and nothing named a Ticket for this Session — the row SAYS so (#894). It used to
    /// vanish, which a reader cannot tell from a header that failed to load, and which hid the one
    /// state they can repair by cutting a branch that names the ticket.
    @Test
    func `a Session nothing linked to a ticket says so rather than dropping the row`() {
        let header = header(ticket: .unlinked)

        #expect(header.issue == .unlinked)
        #expect(header.issue?.label == "No ticket linked")
        #expect(header.issue?.detail == nil)
        #expect(header.announcement.contains("No ticket linked"))
    }

    @Test
    func `a linked issue is named, never left as a bare number`() throws {
        let linked = header(ticket: .linked(.init(number: 400, title: "The Session header")))

        let issue = try #require(linked.issue?.link)
        #expect(issue.label == "Issue #400")
        // Read through verbatim, and absent rather than invented for a provider that gave none.
        #expect(issue.detail == "The Session header")
        #expect(header(ticket: .linked(.init(number: 400))).issue?.detail == nil)
    }

    @Test
    func `with no Ticket provider connected there is no ticket on the header at all`() {
        // Not an empty affordance, not an "attach" control: asserting a link to a provider that
        // does not exist is worse than no link (`CONTEXT.md` L1, and #502's Out of Scope).
        let header = header(ticket: .unread)

        #expect(header.issue == nil)
        #expect(!header.announcement.contains("Issue"))
    }

    @Test
    func `what the header announces carries every fact it draws`() {
        let header = header(
            cli: .claude,
            model: "claude-opus-5",
            workspace: .init(kind: .worktree, branch: "argo/#510", dirty: 2, unpushed: 1),
            // Untitled: a Ticket's title is a title SOURCE, and the chain has its own suite.
            ticket: .linked(.init(number: 510)),
            location: "/Users/milad/Developer/argo/.claude/worktrees/tkt-510",
        )

        // Each mark says what it COUNTS, once, in the same order the header draws it.
        #expect(header.announcement == [
            "Session",
            "Claude Code",
            "Issue #510",
            "On argo/#510, in the worktree tkt-510",
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
            access: .orphaned,
            status: .idle,
            chain: .init(program: .init(cli: .claude, model: "claude-opus-5")),
            work: .init(location: "/Users/milad/Developer/argo", workspace: .init(branch: "main")),
        ))

        #expect(header.announcement.hasSuffix("On main, Orphaned"))
    }

    private func header(
        cli: AgentCLI? = .claude,
        model: String? = "claude-opus-5",
        workspace: CockpitPresentation.Session.Workspace? = .init(branch: "main"),
        ticket: CockpitPresentation.Session.TicketLinkReading = .unread,
        location: String = "/Users/milad/Developer/argo",
    )
        -> SessionHeaderProjection.Header {
        SessionHeaderProjection.header(from: CockpitPresentation.Session(
            id: "session",
            title: "Session",
            access: .managed,
            status: .idle,
            chain: .init(program: .init(cli: cli, model: model)),
            work: .init(
                location: location,
                workspace: workspace,
                ticket: ticket,
            ),
        ))
    }
}
