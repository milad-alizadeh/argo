import Foundation

/// Every file in a Session's Workspace, as paths relative to it (#687) — what the composer's `@`
/// picker lists.
///
/// An actor because the app's adapter blocks on a subprocess and the caller is the main actor.
///
/// `git ls-files` can name no path outside the tree, and honours `.gitignore` without Argo reading
/// one — the two properties the picker's scope depends on.
actor WorkspaceFileReader {
    private let git: GitCommand

    init(git: @escaping GitCommand = gitCommand) {
        self.git = git
    }

    /// Empty for a folder git will not answer for — a plain directory that is no repository.
    func files(at directoryURL: URL) -> [String] {
        guard let output = git(Self.arguments, directoryURL) else { return [] }
        return output.split(separator: Self.separator).map(String.init)
    }

    /// Tracked AND untracked-but-not-ignored: a file the user just wrote is exactly the one they
    /// want to name, and it is not in the index yet.
    ///
    /// `-z` is load-bearing. git's default listing quotes and escapes a path with a newline in it,
    /// and split on newlines that one file becomes two paths, neither of which exists.
    private static let arguments = ["ls-files", "--cached", "--others", "--exclude-standard", "-z"]

    private static let separator: Character = "\0"
}

/// Listing the files in one folder's Workspace.
public typealias WorkspaceFileRead = @Sendable (URL) async -> [String]

/// One reader for the process, so the blocking calls queue rather than running a subprocess each.
public let gitWorkspaceFileRead: WorkspaceFileRead = { url in
    await gitWorkspaceFileReader.files(at: url)
}

private let gitWorkspaceFileReader = WorkspaceFileReader()
