import Foundation

/// What a Session's working folder is, read off git's answers: whether it is a worktree of its
/// own, what is uncommitted in it, and what is unpushed from it.
///
/// An actor for the reason `CheckoutReader` is one — the app's adapter blocks on a subprocess and
/// the caller is the main actor. A folder git cannot answer for is `nil` rather than a projection
/// of zeroes: nothing observed is not a clean tree.
actor WorkspaceReader {
    private let git: GitCommand

    init(git: @escaping GitCommand = gitCommand) {
        self.git = git
    }

    func read(at directoryURL: URL) -> WorkspaceProjection? {
        // The whole read hangs off this answer rather than any one number inside it.
        guard let dirty = dirtyCount(at: directoryURL) else { return nil }
        return WorkspaceProjection(
            kind: isWorktree(at: directoryURL) ? .worktree : .main,
            branch: branch(at: directoryURL),
            dirty: dirty,
            unpushed: unpushedCount(at: directoryURL),
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

    /// The branch the folder is on, and nothing for a detached HEAD — `HEAD` is what git answers
    /// there, and it is not a name anybody can check out.
    private func branch(at directoryURL: URL) -> String? {
        let head = answer(["rev-parse", "--abbrev-ref", "HEAD"], at: directoryURL)
        return head == "HEAD" ? nil : head
    }

    /// A linked worktree keeps its own git directory and shares the repository's common one; the
    /// primary checkout has the same path for both. Comparing git's two answers is the check —
    /// a path under `.claude/worktrees/` is this repository's convention, not git's.
    private func isWorktree(at directoryURL: URL) -> Bool {
        guard let output = answer(
            ["rev-parse", "--path-format=absolute", "--git-dir", "--git-common-dir"],
            at: directoryURL,
        ) else { return false }
        let paths = output.split(whereSeparator: \.isNewline)
        guard paths.count == 2 else { return false }
        return paths[0] != paths[1]
    }

    /// Commits the upstream has not seen. A branch with no upstream makes git exit non-zero, and
    /// that `nil` is carried all the way to the header rather than being read as zero.
    private func unpushedCount(at directoryURL: URL) -> Int? {
        answer(["rev-list", "--count", "@{upstream}..HEAD"], at: directoryURL).flatMap(Int.init)
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
