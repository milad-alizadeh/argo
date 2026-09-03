@testable import ArgoEngine
import Foundation
import Testing

/// What a Session that ENTERS a worktree mid-run says about itself, and what Argo may read off it
/// (#1118).
///
/// The shape is the real 1117 transcript's: 42 records at the main checkout, then 87 under
/// `.claude/worktrees/ticket-1117-<slug>`, with the CLI writing `gitBranch` as the literal `HEAD`
/// and then the transient `worktree-ticket-1117-<slug>` — never the `argo/#1117-<slug>` the branch
/// was renamed to. Two facts follow, and the ticket link needs both.
@Suite("Worktree context reading")
struct WorktreeContextReadingTests {
    private static let checkout = "/Users/x/proj"
    private static let worktree = "\(checkout)/.claude/worktrees/ticket-1117-synthetic-fixture"
    /// What `EnterWorktree` names the branch, before the rename to `argo/#1117-<slug>` that the
    /// CLI never caught up with.
    private static let transientBranch = "worktree-ticket-1117-synthetic-fixture"

    private func folders(_ events: [TranscriptEvent]) -> [String] {
        events.compactMap { event in
            guard case let .cwd(cwd) = event else { return nil }
            return cwd
        }
    }

    private func line(cwd: String, gitBranch: String?) -> String {
        let field = gitBranch.map { "\"gitBranch\": \"\($0)\", " } ?? ""
        return """
        {"type": "user", "message": {"role": "user", "content": "hi"}, "uuid": "u", \
        \(field)"cwd": "\(cwd)", "sessionId": "s"}
        """
    }

    /// The reading the old cursor could not make. A run switches branch mid-session but never its
    /// root — except that `EnterWorktree` is exactly that, and it is mandatory for every ticket
    /// build in this repo, so the first cwd is the one folder the Session is NOT in.
    @Test
    func `a Session that enters a worktree is read at the folder it moved to`() async {
        let reader = TranscriptReader()
        let lines = [
            line(cwd: Self.checkout, gitBranch: "main"),
            line(cwd: Self.checkout, gitBranch: "main"),
            line(cwd: Self.worktree, gitBranch: "HEAD"),
            line(cwd: Self.worktree, gitBranch: "HEAD"),
        ]

        let read = await folders(reader.read(lines: lines))

        // Announced twice and not five times: the latest reading, still emitted only on a change.
        #expect(read == [Self.checkout, Self.worktree])
    }

    /// `HEAD` is git's word for a detached checkout, not a name anybody can check out, so it is no
    /// branch at all.
    @Test
    func `the literal HEAD is no branch`() {
        var session = HubSession(observation: hubTestObservation(id: "worktree", events: []))

        session.apply(.branch("HEAD"))

        #expect(session.branch == nil)
    }

    @Test
    func `a real branch name after HEAD replaces it`() {
        var session = HubSession(observation: hubTestObservation(id: "worktree", events: []))
        session.apply(.branch("HEAD"))

        session.apply(.branch(Self.transientBranch))

        #expect(session.branch == Self.transientBranch)
    }

    /// The 1117 transcript interleaves the two (145 `HEAD` records to 71 transient ones), so this
    /// order is the ordinary one rather than a corner. It reads nothing rather than the last real
    /// name: a detached HEAD is what the run is on NOW, and holding the older name would be a
    /// present-tense claim off a past record (`CONTEXT.md` degrade-down).
    @Test
    func `a HEAD after a real name takes the branch back to nothing`() {
        var session = HubSession(observation: hubTestObservation(id: "worktree", events: []))
        session.apply(.branch(Self.transientBranch))

        session.apply(.branch("HEAD"))

        #expect(session.branch == nil)
    }

    /// A branch the rename never reached names no ticket, and the folder is what places the Session
    /// — which only works once the folder is the one it MOVED to.
    @Test
    func `the worktree folder places a Session whose branch never caught up`() {
        #expect(TicketLink.number(
            branch: Self.transientBranch, workspaceLocation: Self.worktree,
        ) == 1117)
        // The defect in one assertion: read at the folder it started in, the same Session is
        // unplaced.
        #expect(TicketLink.number(
            branch: Self.transientBranch, workspaceLocation: Self.checkout,
        ) == nil)
    }

    /// End to end over the two readings above: the records say `HEAD` and a folder, and the Session
    /// they fold into is on #1117.
    @Test
    @MainActor
    func `a Session whose records moved into a worktree links to its ticket`() async {
        let hub = testHub(projectURL: URL(fileURLWithPath: Self.checkout))
        let observed = hubTestObservation(id: "session", events: [
            .cwd(Self.checkout), .branch("HEAD"), .cwd(Self.worktree), .branch("HEAD"),
        ])

        await hubObserveToEnd(hub, observed)

        let session = hub.sessions.first
        #expect(session?.cwd == Self.worktree)
        #expect(session?.branch == nil)
        #expect(TicketLink.number(branch: session?.branch, workspaceLocation: session?.cwd) == 1117)
    }
}
