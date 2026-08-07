import Foundation

/// Whether a Session's working directory places it inside a Project.
enum ProjectScope {
    /// A prefix over path COMPONENTS, never over the string: `/tmp/checkout-two` is not inside
    /// `/tmp/checkout`, and a string prefix would say it was.
    ///
    /// Anything below the root counts, not the root alone — a session started in a subdirectory, or
    /// in a worktree kept under the repo, is working on this Project. Both sides are resolved
    /// through their symlinks first, because the CLI records the path it was launched at and the
    /// Project was registered at whatever the user typed; `/tmp` and `/private/tmp` are the same
    /// directory and must not read as two Projects.
    static func contains(cwd: String, projectURL: URL) -> Bool {
        let root = components(of: projectURL)
        let candidate = components(of: URL(fileURLWithPath: cwd))
        guard candidate.count >= root.count else { return false }
        return Array(candidate.prefix(root.count)) == root
    }

    private static func components(of url: URL) -> [String] {
        url.standardizedFileURL.resolvingSymlinksInPath().pathComponents
    }
}
