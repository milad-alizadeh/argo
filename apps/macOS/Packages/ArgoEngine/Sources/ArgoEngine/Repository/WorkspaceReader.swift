import Foundation

/// What one working tree looks like, read off git's answers: what is uncommitted in it, what it has
/// drifted from its upstream by, and what it is measured against.
///
/// `kind`, `branch` and `headSha` are taken from the entry and never asked of git here: the listing
/// that found the worktree already answered them.
///
/// An actor because the app's adapter blocks on a subprocess and the caller is the main actor. A
/// folder git cannot answer for is `nil` rather than a projection of zeroes — nothing observed is
/// not a clean tree.
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
            kind: entry.kind,
            refs: WorkspaceProjection.Refs(
                branch: entry.branch,
                baseRef: baseRef(at: directoryURL),
                headSha: entry.headSha,
            ),
            drift: WorkspaceProjection.Drift(
                dirty: dirty,
                divergence: divergence(at: directoryURL),
            ),
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
    ///
    /// Absent wherever git will not name one, which is more often than "no remote": `origin/HEAD`
    /// is a local symref a fresh clone sets and many checkouts never have, and a remote called
    /// anything but `origin` has none under this name at all. So this is a DERIVED read that says
    /// nothing rather than a base Argo can always state — asking a second question to guess at the
    /// default branch would invent the very fact the absence is honest about.
    private func baseRef(at directoryURL: URL) -> String? {
        gitValue(git, ["rev-parse", "--abbrev-ref", "origin/HEAD"], at: directoryURL)
    }

    /// Both counts from one range. Left of the three dots is what the upstream has and HEAD does
    /// not, right is the reverse — asked together so the pair is one reading of one history.
    ///
    /// A branch with no upstream makes git exit non-zero, and that absence is carried all the way
    /// to the header rather than being read as two zeroes.
    private func divergence(at directoryURL: URL) -> UpstreamDivergence? {
        let counts = gitValue(
            git, ["rev-list", "--count", "--left-right", "@{upstream}...HEAD"], at: directoryURL,
        )?.split(whereSeparator: \.isWhitespace).compactMap { Int($0) }
        guard let counts, counts.count == 2 else { return nil }
        return UpstreamDivergence(ahead: counts[1], behind: counts[0])
    }
}
