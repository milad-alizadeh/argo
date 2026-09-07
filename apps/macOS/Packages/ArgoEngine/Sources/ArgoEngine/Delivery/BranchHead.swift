import Foundation

/// The branch a Delivery is asked about, and the commit at that branch's head.
///
/// The branch is what a Delivery is keyed by (`CONTEXT.md` L1 · Delivery) and the commit is how
/// the host is asked for it once the ref is gone (ADR-0032). Both are read off one
/// `WorkspaceProjection`, so nothing holds a branch from one git read and a commit from another.
public struct BranchHead: Equatable, Sendable {
    public let branch: String
    /// `nil` where git named no commit — which is a Workspace read that answered a branch and no
    /// tip, and leaves the branch reading as the whole of the lookup.
    public let sha: String?

    public init(branch: String, sha: String? = nil) {
        self.branch = branch
        self.sha = sha
    }
}
