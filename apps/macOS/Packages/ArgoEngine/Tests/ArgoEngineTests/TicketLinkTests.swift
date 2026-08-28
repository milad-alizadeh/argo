@testable import ArgoEngine
import Testing

/// Which Ticket a Session is serving, read off its git context by convention (#745).
@Suite("Ticket link")
struct TicketLinkTests {
    @Test(arguments: [
        ("argo/#741-derive-the-work-item-link", 741),
        ("argo/#30-session-screen", 30),
        // No slug: the number is the whole stem, and nothing terminates it but the end.
        ("argo/#502", 502),
        // A consumer's own namespace. The convention is the `#<N>`, never the `argo/` in front.
        ("feature/#12-a-thing", 12),
    ])
    func `a ticket branch names the Ticket it was cut for`(branch: String, number: Int) {
        #expect(TicketLink.number(branch: branch, workspaceLocation: nil) == number)
    }

    @Test(arguments: [
        "main",
        // The no-ticket shape `docs/agents/worktrees.md` fixes for work with no number.
        "argo/tidy-the-rules",
        // A `#` with nothing to read after it is not a number.
        "argo/#-no-number",
        "argo/#",
        // Three SHAPES this repo's own worktrees actually produce (#894), sampled rather than
        // inventoried — they carry no number in the branch or the folder, and no recogniser,
        // however wide, recovers a number nobody wrote. The repair is upstream of Argo; what Argo
        // owes is to say it could not tell rather than to guess.
        "worktree-885-screenshot-pid-scope",
        "worktree-parallel-workitem-edges",
        "worktree-ticket-verbs-detail-pane",
    ])
    func `a branch carrying no number links to nothing`(branch: String) {
        #expect(TicketLink.number(branch: branch, workspaceLocation: nil) == nil)
    }

    /// `worktree-885-…` reads as a folder stem and not as a ticket: the prefix
    /// `docs/agents/worktrees.md` fixes is `ticket-`, and widening it to any leading number would
    /// read #885 off a folder that names a worktree rather than a Ticket (#894).
    @Test
    func `a worktree folder that is not a ticket folder names no Ticket`() {
        let number = TicketLink.number(
            branch: "worktree-885-screenshot-pid-scope",
            workspaceLocation: "/Users/milad/Developer/argo/.claude/worktrees/"
                + "worktree-885-screenshot-pid-scope",
        )

        #expect(number == nil)
    }

    @Test
    func `a Session with no branch at all links to nothing`() {
        #expect(TicketLink.number(branch: nil, workspaceLocation: nil) == nil)
    }

    @Test
    func `the worktree folder names the ticket for a Session whose branch does not`() {
        // The window between `EnterWorktree` and the `git branch -m` rename, where the branch is
        // still `worktree-ticket-<N>-<slug>` — and the folder is the only thing that says #745.
        let number = TicketLink.number(
            branch: "main",
            workspaceLocation: "/Users/milad/Developer/argo/.claude/worktrees/ticket-745-derive",
        )

        #expect(number == 745)
    }

    @Test
    func `the branch outranks the folder when the two disagree`() {
        // A branch is re-cut where a folder is reused, so the branch is the fresher claim.
        let number = TicketLink.number(
            branch: "argo/#800-a-second-ticket",
            workspaceLocation: "/Users/milad/Developer/argo/.claude/worktrees/ticket-745-derive",
        )

        #expect(number == 800)
    }

    @Test
    func `a worktree folder cut for no ticket links to nothing`() {
        // `ticket-<slug>` is the shape for work with no number, and it must not read as one.
        let number = TicketLink.number(
            branch: "main",
            workspaceLocation: "/Users/milad/Developer/argo/.claude/worktrees/ticket-tidy-rules",
        )

        #expect(number == nil)
    }

    @Test
    func `a folder that is not a worktree at all links to nothing`() {
        #expect(TicketLink.number(
            branch: "main", workspaceLocation: "/Users/milad/Developer/argo",
        ) == nil)
    }

    @Test
    func `a number that is not one links to nothing`() {
        // Degrade-down: `#0` and `#-3` resolve to no Ticket rather than to a guess at one.
        #expect(TicketLink.number(branch: "argo/#0-nothing", workspaceLocation: nil) == nil)
    }
}
