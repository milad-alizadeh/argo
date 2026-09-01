/// Whether a Session's working directory places it inside a Project.
enum ProjectScope {
    /// A prefix over path COMPONENTS, never over the string: `/tmp/checkout-two` is not inside
    /// `/tmp/checkout`, and a string prefix would say it was.
    ///
    /// Anything below the root counts, not the root alone — a session started in a subdirectory, or
    /// in a worktree kept under the repo, is working on this Project.
    ///
    /// The filesystem root scopes to NOTHING, rather than to everything. It is what a Project falls
    /// back to when there is no working directory to take one from — an app launched from Finder
    /// has no cwd — and reading that prefix literally would put every Session in one roster.
    static func contains(cwd: SpelledPath, projectRoot: SpelledPath) -> Bool {
        guard let root = components(of: projectRoot.value), !root.isEmpty,
              let candidate = components(of: cwd.value), candidate.count >= root.count
        else { return false }
        return Array(candidate.prefix(root.count)) == root
    }

    /// Absolute paths only, `.` and `..` walked, and nothing asked of the file system —
    /// `URL.standardizedFileURL` drops a leading `/private` from a path that EXISTS and leaves it
    /// on one that does not.
    ///
    /// A relative path is `nil` rather than a comparison: the separator it lacks is the one `split`
    /// drops, so `checkout/deep` would otherwise sit inside `/checkout`.
    private static func components(of path: String) -> [String]? {
        guard path.hasPrefix("/") else { return nil }
        return path.split(separator: "/").reduce(into: [String]()) { walked, step in
            switch step {
            case ".":
                return
            case "..":
                // `/..` is `/` to the kernel, so the root is where walking up stops.
                if !walked.isEmpty {
                    walked.removeLast()
                }
            default:
                walked.append(String(step))
            }
        }
    }
}
