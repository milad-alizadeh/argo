/// The git working context one Session is running in (`CONTEXT.md` L3), as git answers it.
///
/// Distinct from `CheckoutProjection`, which is the ONE checkout the window is pointed at: this is
/// read per Session cwd, and two Sessions in two worktrees of one repository have two of these.
public struct WorkspaceProjection: Equatable, Sendable {
    /// Whether the folder is the repository's own checkout or one it was given (`CONTEXT.md` L3).
    /// Declared once here and aliased by the shell, never restated as a second enum.
    public enum Kind: Equatable, Sendable {
        case main
        case worktree
    }

    public let kind: Kind
    /// The branch the folder is on right now, read at the same moment as the counts below so the
    /// three are one reading rather than a name from the transcript beside numbers from git.
    /// Absent for a detached HEAD, and for a repository git would not name a branch in.
    public let branch: String?
    /// How many files are changed and not committed. A DIRECT count of what git reported, so a
    /// zero here means git said nothing was dirty — never that nobody asked.
    public let dirty: Int
    /// How many commits are ahead of the branch's upstream. Absent for a branch with no upstream
    /// at all: there is nothing to be ahead OF, which is a different fact from being level with it.
    public let unpushed: Int?

    public init(kind: Kind, branch: String?, dirty: Int, unpushed: Int?) {
        self.kind = kind
        self.branch = branch
        self.dirty = dirty
        self.unpushed = unpushed
    }
}
