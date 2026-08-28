/// Which Workspace an Agent renders, when the tree it sits in is what decides (ADR-0010).
///
/// Claude Code's `isolation: "worktree"` gives a Subagent its own branch and folder, so identity
/// attaches to the Agent and not to the Session.
enum WorkspaceInheritance {
    /// The Workspace one Agent renders: its own where it owns one, else the nearest ancestor's,
    /// and nothing at all where no Agent up the chain owns one.
    ///
    /// Stops on a node it has already stood on: a `parentId` table read out of a transcript is not
    /// proof of a tree, and a cycle in one must answer nothing rather than hang the read.
    static func resolved(
        ofAgent agentID: String,
        owned: [String: WorkspaceProjection],
        parents: [String: String],
    )
        -> WorkspaceProjection? {
        var visited: Set<String> = []
        var node: String? = agentID
        while let current = node, visited.insert(current).inserted {
            if let workspace = owned[current] {
                return workspace
            }
            node = parents[current]
        }
        return nil
    }
}
