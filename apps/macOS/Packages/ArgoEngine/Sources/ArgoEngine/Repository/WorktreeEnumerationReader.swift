import Foundation

/// Which working trees a repository holds, read off git's own listing.
///
/// An actor because the app's adapter blocks on a subprocess and the caller is the main actor.
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
