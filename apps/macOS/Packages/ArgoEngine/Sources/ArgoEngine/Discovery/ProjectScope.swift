import Foundation

/// Whether a Session's working directory places it inside a Project.
enum ProjectScope {
    /// A prefix over path COMPONENTS, never over the string: `/tmp/checkout-two` is not inside
    /// `/tmp/checkout`, and a string prefix would say it was.
    ///
    /// Anything below the root counts, not the root alone — a session started in a subdirectory, or
    /// in a worktree kept under the repo, is working on this Project.
    ///
    /// BOTH SIDES ARRIVE SPELLED. The CLI records the path it was launched at and the Project was
    /// registered at whatever the user typed, so `/var/folders/…` and `/private/var/folders/…` are
    /// one directory reaching here as two strings (#363) — but resolving them is a file-system
    /// call, and this is read once per spawned row per read of the roster on the main actor
    /// (ADR-0028 Rule 6). So the resolution happens at the two seams that MINT the key — the
    /// observer's read of a transcript's `cwd`, and the readings' spelling table the roster asks —
    /// and what is left here is string arithmetic. A path the file system could not spell arrives
    /// as written, which still matches an equal string and never invents a match.
    ///
    /// The filesystem root scopes to NOTHING, rather than to everything. It is what a Project falls
    /// back to when there is no working directory to take one from — an app launched from Finder
    /// has no cwd — and reading that prefix literally would put every Session in one roster.
    static func contains(cwd: String, projectRoot: String) -> Bool {
        let root = components(of: projectRoot)
        guard !root.isEmpty else { return false }
        let candidate = components(of: cwd)
        guard candidate.count >= root.count else { return false }
        return Array(candidate.prefix(root.count)) == root
    }

    /// Split, and NOT `standardizedFileURL`, which asks the file system: it drops a leading
    /// `/private` from a path that exists and leaves it on one that does not, so a Project and a
    /// deleted worktree inside it came out as two directories (#363). Empty components are dropped,
    /// which is what makes a trailing slash and a doubled one nothing.
    private static func components(of path: String) -> [String] {
        path.split(separator: "/").map(String.init)
    }
}
