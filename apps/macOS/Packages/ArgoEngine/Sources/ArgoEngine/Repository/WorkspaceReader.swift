import Foundation

/// What one working tree looks like, read off git's answers: what is uncommitted in it, what it has
/// drifted from its upstream by, and what it is measured against.
///
/// Takes the entry rather than a folder, so `kind`, `branch` and `headSha` come from the listing
/// that found the worktree instead of from a second read of the same facts — two readers of one
/// fact are two chances to disagree about it (#259).
///
/// An actor for the reason `CheckoutReader` is one: the app's adapter blocks on a subprocess and
/// the caller is the main actor. A folder git cannot answer for is `nil` rather than a projection
/// of zeroes — nothing observed is not a clean tree.
actor WorkspaceReader {
    private let git: GitCommand

    init(git: @escaping GitCommand = gitCommand) {
        self.git = git
    }

    func read(_ entry: WorktreeEntry) -> WorkspaceProjection? {
        let directoryURL = URL(fileURLWithPath: entry.path)
        // The whole read hangs off this answer rather than any one number inside it.
        guard let dirty = dirtyCount(at: directoryURL) else { return nil }
        return WorkspaceProjection(
            kind: entry.isPrimary ? .main : .worktree,
            branch: entry.branch,
            baseRef: baseRef(at: directoryURL),
            headSha: entry.headSha,
            dirty: dirty,
            divergence: divergence(at: directoryURL),
        )
    }

    /// The porcelain listing, one line per changed path, with untracked directories expanded to
    /// the FILES in them — `--untracked-files=all`, because the mark beside the count says
    /// "uncommitted files" and porcelain's default collapses a new folder to a single entry.
    ///
    /// An empty answer is a clean tree and counts zero; NO answer is a folder git could not read,
    /// and the two must not come out the same (`CONTEXT.md`, the degrade-down rule).
    private func dirtyCount(at directoryURL: URL) -> Int? {
        git(["status", "--porcelain", "--untracked-files=all"], directoryURL)
            .map { $0.split(whereSeparator: \.isNewline).count }
    }

    /// The ref the branch is measured against: the remote's own default head, as git names it.
    /// Absent for a repository with no remote, which has no shared base to be measured against.
    private func baseRef(at directoryURL: URL) -> String? {
        answer(["rev-parse", "--abbrev-ref", "origin/HEAD"], at: directoryURL)
    }

    /// Both counts from one range. Left of the three dots is what the upstream has and HEAD does
    /// not, right is the reverse — asked together so the pair is one reading of one history.
    ///
    /// A branch with no upstream makes git exit non-zero, and that absence is carried all the way
    /// to the header rather than being read as two zeroes.
    private func divergence(at directoryURL: URL) -> UpstreamDivergence? {
        let counts = answer(
            ["rev-list", "--count", "--left-right", "@{upstream}...HEAD"], at: directoryURL,
        )?.split(whereSeparator: \.isWhitespace).compactMap { Int($0) }
        guard let counts, counts.count == 2 else { return nil }
        return UpstreamDivergence(ahead: counts[1], behind: counts[0])
    }

    /// git ends its answers with a newline, and an answer with nothing left in it is one git did
    /// not give.
    private func answer(_ arguments: [String], at directoryURL: URL) -> String? {
        guard let output = git(arguments, directoryURL)?
            .trimmingCharacters(in: .whitespacesAndNewlines), !output.isEmpty
        else { return nil }
        return output
    }
}
