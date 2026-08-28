import Foundation

/// Which working trees a repository holds, read off git's own listing.
///
/// An actor for the reason `WorkspaceReader` is one — the app's adapter blocks on a subprocess and
/// the caller is the main actor. A folder git will not answer for holds none, which is a different
/// answer from a repository holding one, and the two come out differently because the entry the
/// primary checkout would have is missing rather than empty.
actor WorktreeEnumerationReader {
    private let git: GitCommand

    init(git: @escaping GitCommand = gitCommand) {
        self.git = git
    }

    func list(in directoryURL: URL) -> [WorktreeEntry] {
        guard let porcelain = git(["worktree", "list", "--porcelain"], directoryURL) else {
            return []
        }
        return WorktreeEntry.list(porcelain: porcelain)
    }
}
