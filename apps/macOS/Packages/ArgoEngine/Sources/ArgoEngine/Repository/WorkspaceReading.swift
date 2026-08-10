import Foundation

/// Reading the git working context of one folder: what kind of checkout it is, and what is
/// uncommitted and unpushed in it.
///
/// A port for the same reason `CheckoutRead` is one — what the Hub makes of a Workspace has to be
/// falsifiable without a repository on disk. `nil` is a folder git could not answer for.
public typealias WorkspaceRead = @Sendable (URL) async -> WorkspaceProjection?

/// The app's adapter: git, through a subprocess. One reader for the process, so the blocking calls
/// queue behind one another rather than running a subprocess per Session on every poll.
public let gitWorkspaceRead: WorkspaceRead = { url in
    await gitWorkspaceReader.read(at: url)
}

private let gitWorkspaceReader = WorkspaceReader()
