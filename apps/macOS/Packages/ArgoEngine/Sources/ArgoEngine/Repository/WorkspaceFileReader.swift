import Foundation

/// Every file in a Session's Workspace, as paths relative to it (#687) — what the composer's `@`
/// picker lists.
///
/// An actor for the reason `WorkspaceReader` is one: the app's adapter blocks on a subprocess and
/// the caller is the main actor.
///
/// `git ls-files` rather than a directory walk, for three reasons at once. It cannot name a path
/// outside the tree, which is the acceptance criterion about scope. It honours `.gitignore`
/// without Argo reading one, so `node_modules` never reaches the list. And it costs one process
/// where a walk costs a syscall per directory on a tree nine segments deep.
actor WorkspaceFileReader {
    private let git: GitCommand

    init(git: @escaping GitCommand = gitCommand) {
        self.git = git
    }

    /// The listing, or nothing at all for a folder git will not answer for — a plain directory
    /// that is no repository. Empty either way, because the picker draws the same nothing; the
    /// distinction the Workspace read makes matters there and not here, since no count is stated.
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

/// Listing the files in one folder's Workspace. A port for the reason `WorkspaceRead` is one —
/// what the picker makes of a tree has to be falsifiable with no repository on disk.
public typealias WorkspaceFileRead = @Sendable (URL) async -> [String]

/// The app's adapter: git, through a subprocess. One reader for the process, so the blocking calls
/// queue behind one another rather than running a subprocess per keystroke.
public let gitWorkspaceFileRead: WorkspaceFileRead = { url in
    await gitWorkspaceFileReader.files(at: url)
}

private let gitWorkspaceFileReader = WorkspaceFileReader()
