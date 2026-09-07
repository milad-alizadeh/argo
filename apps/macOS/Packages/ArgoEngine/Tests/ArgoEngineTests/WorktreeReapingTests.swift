@testable import ArgoEngine
import Foundation
import Testing

/// The rules that decide whether archiving a Session may take its worktree with it (#1398).
@Suite("Worktree reaping")
struct WorktreeReapingTests {
    private static let path = "/repo/.claude/worktrees/ticket-1398-archive"
    private static let branch = "argo/#1398-archive"
    private static let headSha = "bbb"

    /// A landed worktree: Argo's own, clean, level with its upstream, and held by the one Session
    /// being archived. Each test spoils exactly the fact it is about.
    private static func landed(
        kind: WorkspaceProjection.Kind = .worktree,
        branch: String? = branch,
        dirty: Int = 0,
        divergence: UpstreamDivergence? = UpstreamDivergence(ahead: 0, behind: 0),
        holders: Int = 1,
    )
        -> WorkspaceProjection {
        WorkspaceProjection(
            kind: kind,
            refs: .init(branch: branch, headSha: headSha),
            drift: .init(dirty: dirty, divergence: divergence),
            held: .init(count: holders, tier: .direct),
        )
    }

    @Test
    func `a clean pushed worktree of Argo's own is a candidate for its branch`() {
        let verdict = WorktreeReaping.candidate(at: Self.path, workspace: Self.landed())

        #expect(verdict == .reap(.init(
            path: Self.path,
            branch: Self.branch,
            headSha: Self.headSha,
        )))
    }

    @Test
    func `the repository's own checkout is never reaped`() {
        let verdict = WorktreeReaping.candidate(
            at: "/repo", workspace: Self.landed(kind: .main),
        )

        #expect(verdict == .hold(.notArgosOwn))
    }

    @Test
    func `a worktree outside Argo's own folder is never reaped`() {
        // A person's own `git worktree add /tmp/spike`: linked, clean, landed, and not Argo's to
        // delete.
        let verdict = WorktreeReaping.candidate(at: "/tmp/spike", workspace: Self.landed())

        #expect(verdict == .hold(.notArgosOwn))
    }

    @Test
    func `a folder no Workspace was read for is held rather than reaped`() {
        let verdict = WorktreeReaping.candidate(at: Self.path, workspace: nil)

        // An unread worktree is not a clean one, and it is not one of somebody else's either.
        #expect(verdict == .hold(.unread))
    }

    @Test
    func `a detached HEAD names no branch, so nothing can be said to have landed`() {
        let verdict = WorktreeReaping.candidate(
            at: Self.path, workspace: Self.landed(branch: nil),
        )

        #expect(verdict == .hold(.unread))
    }

    @Test
    func `uncommitted changes hold the worktree, and the count says how many`() {
        let verdict = WorktreeReaping.candidate(
            at: Self.path, workspace: Self.landed(dirty: 3),
        )

        #expect(verdict == .hold(.dirty(3)))
    }

    @Test
    func `commits the upstream has not seen hold the worktree`() {
        let verdict = WorktreeReaping.candidate(
            at: Self.path,
            workspace: Self.landed(divergence: UpstreamDivergence(ahead: 2, behind: 0)),
        )

        #expect(verdict == .hold(.unpushed(2)))
    }

    /// The reporter's own case (#1398): GitHub deletes a head branch as it squash-merges it, so by
    /// the time the sweep next prunes, the worktree git could measure yesterday has no upstream ref
    /// left. Held on that absence, this check would refuse every landed worktree there is.
    @Test
    func `a branch whose upstream is gone is not held for it`() {
        let verdict = WorktreeReaping.candidate(
            at: Self.path, workspace: Self.landed(divergence: nil),
        )

        #expect(verdict == .reap(.init(
            path: Self.path,
            branch: Self.branch,
            headSha: Self.headSha,
        )))
    }

    @Test
    func `a second Agent in the folder holds it, the first being the Session archived`() {
        let verdict = WorktreeReaping.candidate(
            at: Self.path, workspace: Self.landed(holders: 2),
        )

        #expect(verdict == .hold(.held(2)))
    }

    @Test
    func `a worktree nobody is standing in is still a candidate`() {
        let verdict = WorktreeReaping.candidate(
            at: Self.path, workspace: Self.landed(holders: 0),
        )

        #expect(verdict == .reap(.init(
            path: Self.path,
            branch: Self.branch,
            headSha: Self.headSha,
        )))
    }

    /// The head commit travels with the candidate because the landed question outlives the ref it
    /// is about — the host is asked by commit once the branch is gone (ADR-0032).
    @Test
    func `a candidate carries the head commit the landed question is asked by`() {
        let verdict = WorktreeReaping.candidate(at: Self.path, workspace: Self.landed())

        guard case let .reap(candidate) = verdict else { return #expect(Bool(false)) }
        #expect(candidate.headSha == Self.headSha)
    }

    @Test
    func `a candidate the code host does not call merged stays`() {
        let candidate = WorktreeReaping.Candidate(
            path: Self.path, branch: Self.branch, headSha: Self.headSha,
        )

        #expect(candidate.verdict(landed: false) == .hold(.notLanded))
    }

    @Test
    func `a candidate the code host calls merged is reaped`() {
        let candidate = WorktreeReaping.Candidate(
            path: Self.path, branch: Self.branch, headSha: Self.headSha,
        )

        #expect(candidate.verdict(landed: true) == .reap(candidate))
    }
}
