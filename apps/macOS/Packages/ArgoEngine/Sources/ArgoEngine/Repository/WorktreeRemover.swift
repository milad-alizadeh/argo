import Foundation

/// One landed worktree taken off disk, and its branch with it.
///
/// An actor because the app's adapter blocks on a subprocess and the caller is the main actor.
actor WorktreeRemover {
    private let git: GitInvocation

    init(git: @escaping GitInvocation = gitInvocation) {
        self.git = git
    }

    /// The two commands `worktree-gc` runs, in its order and for its reasons.
    ///
    /// The worktree first: it is the destructive one, and a branch deleted ahead of a removal git
    /// then refuses would leave the folder standing with no name on it.
    func remove(
        _ candidate: WorktreeReaping.Candidate, from repositoryURL: URL,
    )
        -> WorktreeRemoval {
        guard let answer = git(["worktree", "remove", candidate.path], repositoryURL) else {
            return .refused("git could not be run")
        }
        guard answer.isSuccess else {
            return .refused(answer.errorOutput.trimmingCharacters(in: .whitespacesAndNewlines))
        }
        // `-D`, not `-d`: this repo squash-merges, so a landed branch never reads as merged to git
        // and the safe spelling would refuse every one of them. What made it safe was the check
        // that got us here (`WorktreeReaping`), not git's own.
        //
        // Its answer is dropped. The worktree is gone either way, which is what archiving asked
        // for; a branch git would not delete is a ref left behind, not a failed removal.
        _ = git(["branch", "-D", candidate.branch], repositoryURL)
        return .removed
    }
}
