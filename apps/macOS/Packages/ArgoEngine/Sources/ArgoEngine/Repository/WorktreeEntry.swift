import Foundation

/// One working tree of a repository, as `git worktree list --porcelain` names it.
///
/// The listing is what makes a worktree observable independently of any Session: `worktree-gc`
/// reaps only after a pull request merges, so a worktree routinely outlives the run that made it,
/// and a branch read off the roster alone would lose it (#259, #202 — observed, never created).
public struct WorktreeEntry: Equatable, Sendable {
    /// The folder git holds it in, verbatim.
    public let path: String
    /// The branch checked out there, with `refs/heads/` taken off. Absent for a detached HEAD,
    /// which is not a name anybody can check out.
    public let branch: String?
    /// The commit checked out there, whole and in git's own form — what a Diff is addressed by
    /// (`CONTEXT.md` L4 · Diff). Absent for a block that named none.
    public let headSha: String?
    /// Whether this is the repository's own checkout rather than a linked worktree. Read off the
    /// position git listed it in: `.claude/worktrees/` is Argo's convention, not git's, and a
    /// worktree may sit anywhere on disk.
    public let isPrimary: Bool

    public init(path: String, branch: String?, headSha: String?, isPrimary: Bool) {
        self.path = path
        self.branch = branch
        self.headSha = headSha
        self.isPrimary = isPrimary
    }

    /// The listing, in git's own order. One entry per blank-line-separated block, and none for a
    /// bare repository's — it holds no working tree, so it is not a Workspace and not the PRIMARY
    /// one either.
    static func list(porcelain: String) -> [WorktreeEntry] {
        porcelain
            .components(separatedBy: "\n\n")
            .enumerated()
            .compactMap { entry(in: $0.element, isPrimary: $0.offset == 0) }
    }

    /// One block. `nil` where it named no working tree — a bare repository's, and the empty tail
    /// git's own trailing newline leaves behind.
    private static func entry(in block: String, isPrimary: Bool) -> WorktreeEntry? {
        let lines = block.split(whereSeparator: \.isNewline).map(String.init)
        guard let path = value(of: "worktree", in: lines), !lines.contains("bare") else {
            return nil
        }
        return WorktreeEntry(
            path: path,
            branch: value(of: "branch", in: lines).map(branchName),
            headSha: value(of: "HEAD", in: lines),
            isPrimary: isPrimary,
        )
    }

    /// What one keyed line said, or nothing where the block carried no such line. Matched on the
    /// key plus its space, so `locked`'s free prose is never read as a `branch`.
    private static func value(of key: String, in lines: [String]) -> String? {
        lines.first { $0.hasPrefix(key + " ") }
            .map { String($0.dropFirst(key.count + 1)) }
    }

    /// A ref as a branch name. Only the `refs/heads/` prefix comes off; everything after it is the
    /// name verbatim, `#` included.
    private static func branchName(_ ref: String) -> String {
        ref.hasPrefix(headsPrefix) ? String(ref.dropFirst(headsPrefix.count)) : ref
    }
}

private let headsPrefix = "refs/heads/"
