import Foundation

/// The local half of a Delivery derivation, read off the Hub (#258, #1480).
@MainActor
public extension Hub {
    /// Every worktree of this repository as git last answered for it — a branch is a Delivery
    /// whether or not a Session is on it.
    ///
    /// Taken from the Hub's own reading rather than a second `git worktree list`: the branch is
    /// the join key (#259), and two readers of one fact are two chances to disagree about it.
    var readWorkspaces: [WorkspaceProjection] {
        readings.readWorkspaces
    }
}
