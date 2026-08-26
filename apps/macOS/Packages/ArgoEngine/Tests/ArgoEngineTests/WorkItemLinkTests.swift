@testable import ArgoEngine
import Testing

/// Which Work Item a Session is serving, read off its git context by convention (#745).
@Suite("Work Item link")
struct WorkItemLinkTests {
    @Test(arguments: [
        ("argo/#741-derive-the-work-item-link", 741),
        ("argo/#30-session-screen", 30),
        // No slug: the number is the whole stem, and nothing terminates it but the end.
        ("argo/#502", 502),
        // A consumer's own namespace. The convention is the `#<N>`, never the `argo/` in front.
        ("feature/#12-a-thing", 12),
    ])
    func `a ticket branch names the Work Item it was cut for`(branch: String, number: Int) {
        #expect(WorkItemLink.number(branch: branch, workspaceLocation: nil) == number)
    }

    @Test(arguments: [
        "main",
        // The no-ticket shape `docs/agents/worktrees.md` fixes for work with no number.
        "argo/tidy-the-rules",
        // A `#` with nothing to read after it is not a number.
        "argo/#-no-number",
        "argo/#",
    ])
    func `a branch carrying no number links to nothing`(branch: String) {
        #expect(WorkItemLink.number(branch: branch, workspaceLocation: nil) == nil)
    }

    @Test
    func `a Session with no branch at all links to nothing`() {
        #expect(WorkItemLink.number(branch: nil, workspaceLocation: nil) == nil)
    }

    @Test
    func `the worktree folder names the ticket for a Session whose branch does not`() {
        // The window between `EnterWorktree` and the `git branch -m` rename, where the branch is
        // still `worktree-ticket-<N>-<slug>` — and the folder is the only thing that says #745.
        let number = WorkItemLink.number(
            branch: "main",
            workspaceLocation: "/Users/milad/Developer/argo/.claude/worktrees/ticket-745-derive",
        )

        #expect(number == 745)
    }

    @Test
    func `the branch outranks the folder when the two disagree`() {
        // A branch is re-cut where a folder is reused, so the branch is the fresher claim.
        let number = WorkItemLink.number(
            branch: "argo/#800-a-second-ticket",
            workspaceLocation: "/Users/milad/Developer/argo/.claude/worktrees/ticket-745-derive",
        )

        #expect(number == 800)
    }

    @Test
    func `a worktree folder cut for no ticket links to nothing`() {
        // `ticket-<slug>` is the shape for work with no number, and it must not read as one.
        let number = WorkItemLink.number(
            branch: "main",
            workspaceLocation: "/Users/milad/Developer/argo/.claude/worktrees/ticket-tidy-rules",
        )

        #expect(number == nil)
    }

    @Test
    func `a folder that is not a worktree at all links to nothing`() {
        #expect(WorkItemLink.number(
            branch: "main", workspaceLocation: "/Users/milad/Developer/argo",
        ) == nil)
    }

    @Test
    func `a number that is not one links to nothing`() {
        // Degrade-down: `#0` and `#-3` resolve to no Work Item rather than to a guess at one.
        #expect(WorkItemLink.number(branch: "argo/#0-nothing", workspaceLocation: nil) == nil)
    }
}
