@testable import ArgoEngine
import Foundation

/// What the port was asked, kept off the main actor so the write stays `@Sendable`.
actor AskedOf {
    private(set) var repositoryPath: String?
    private(set) var branch: String?

    func record(repositoryURL: URL, candidate: WorktreeReaping.Candidate) {
        repositoryPath = repositoryURL.path
        branch = candidate.branch
    }
}

/// The repository this suite's Hub is pointed at, the one worktree it holds, and the branch that
/// worktree is on. At file scope because the reads below are handed to an `Engine`, and named once
/// because the suite asserts against the same three.
let reapRepository = "/tmp/argo-reap"
let reapWorktree = reapRepository + "/.claude/worktrees/ticket-1398-archive"
let reapBranch = "argo/#1398-archive"
let reapHeadSha = "bbb"

/// That worktree as git lists it, and as git reads it: Argo's own, clean and level with its
/// upstream, so every local check passes and only the landed question is left.
let landedWorktree = WorktreeEntry(
    path: reapWorktree, branch: reapBranch, headSha: reapHeadSha, kind: .worktree,
)

let landedRead = WorkspaceProjection(
    kind: .worktree,
    refs: WorkspaceProjection.Refs(
        branch: reapBranch, baseRef: "origin/main", headSha: reapHeadSha,
    ),
    drift: WorkspaceProjection.Drift(
        dirty: 0, divergence: UpstreamDivergence(ahead: 0, behind: 0),
    ),
)
