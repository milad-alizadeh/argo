import Foundation

/// Reading the git working context of one working tree: what is uncommitted and unpushed in it, and
/// what it is measured against.
///
/// A port, so what the Hub makes of a Workspace is falsifiable without a repository on disk. `nil`
/// is a worktree git could not answer for.
public typealias WorkspaceRead = @Sendable (WorktreeEntry) async -> WorkspaceProjection?

/// The app's adapter: git, through a subprocess. One reader for the process, so the blocking calls
/// queue behind one another rather than running a subprocess per worktree on every poll.
public let gitWorkspaceRead: WorkspaceRead = { entry in
    await gitWorkspaceReader.read(entry)
}

private let gitWorkspaceReader = WorkspaceReader()
