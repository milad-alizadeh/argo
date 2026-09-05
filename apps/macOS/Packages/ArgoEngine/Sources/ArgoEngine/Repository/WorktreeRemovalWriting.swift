import Foundation

/// Removing one working tree, and the branch it was checked out on with it (#1398).
///
/// A port for the reason every repository read is one: what archiving makes of a landed worktree is
/// falsifiable without a repository on disk. It is the FIRST git write in the engine, so it takes
/// the shape `GitAnswer` was kept for — a refusal carries git's own stderr, which is the actionable
/// half of it.
public typealias WorktreeRemovalWrite = @Sendable (URL, WorktreeReaping.Candidate) async
    -> WorktreeRemoval

/// What became of one removal. `refused` carries git's own words rather than a code: nothing here
/// branches on why, and a reader looking at a worktree that is still there wants the reason git
/// gave.
public enum WorktreeRemoval: Equatable, Sendable {
    case removed
    case refused(String)
}

/// The app's adapter: git, through a subprocess. One remover for the process, so a write queues
/// behind whatever else is talking to git rather than racing it.
public let gitWorktreeRemovalWrite: WorktreeRemovalWrite = { repositoryURL, candidate in
    await gitWorktreeRemover.remove(candidate, from: repositoryURL)
}

private let gitWorktreeRemover = WorktreeRemover()
