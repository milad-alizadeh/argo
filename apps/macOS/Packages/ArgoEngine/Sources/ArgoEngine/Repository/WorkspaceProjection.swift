/// The git working context one Session is running in (`CONTEXT.md` L3), as git answers it.
///
/// Distinct from `CheckoutProjection`, which is the ONE checkout the window is pointed at: this is
/// read per Session cwd, and two Sessions in two worktrees of one repository have two of these.
public struct WorkspaceProjection: Equatable, Sendable {
    /// Whether this folder is a linked worktree rather than the repository's own checkout.
    public let isWorktree: Bool
    /// How many files are changed and not committed. A DIRECT count of what git reported, so a
    /// zero here means git said nothing was dirty — never that nobody asked.
    public let dirty: Int
    /// How many commits are ahead of the branch's upstream. Absent for a branch with no upstream
    /// at all: there is nothing to be ahead OF, which is a different fact from being level with it.
    public let unpushed: Int?

    public init(isWorktree: Bool, dirty: Int, unpushed: Int?) {
        self.isWorktree = isWorktree
        self.dirty = dirty
        self.unpushed = unpushed
    }
}
