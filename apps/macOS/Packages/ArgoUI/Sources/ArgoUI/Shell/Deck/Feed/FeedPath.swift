import Foundation

/// Paths as the feed says them: relative to where the Session is working.
///
/// Inside a Session everything is relative to that Session's own cwd, so the prefix says nothing a
/// reader does not already know. It shortens whatever it is given rather than parsing a path out of
/// it, because a command line carries paths too, in the middle of its own words.
struct FeedPath: Equatable, Sendable {
    /// Where the Session is working. `nil` for a record that never said, which is a real case: a
    /// transcript is read from the first line and the cwd may not have arrived yet.
    let cwd: String?

    /// A feed with nowhere to be relative to. Every address stays as the record wrote it, minus a
    /// home directory, which is this machine either way.
    static let anywhere = FeedPath(cwd: nil)

    func shortened(_ text: String) -> String {
        var shortened = text
        if let cwd, !cwd.isEmpty {
            // The separator goes with the prefix: dropping it would leave every address opening on
            // a slash, reading as absolute when it is the opposite.
            shortened = shortened.replacingOccurrences(of: cwd + "/", with: "")
            // A bare mention of the cwd itself is the Project root, and that is what it is called.
            shortened = shortened.replacingOccurrences(of: cwd, with: ".")
        }
        return shortened.replacingOccurrences(of: FeedPath.home, with: "~")
    }

    /// Whether an address this already shortened names somewhere OUTSIDE the Session's own tree.
    /// Read off what survived the shortening: a path under the cwd comes back relative, so one that
    /// still opens on a root, a home, or a step upwards is one the cwd could not account for.
    ///
    /// A Session that never said where it was working marks nothing — every address in such a feed
    /// is absolute, so the marker would say something about the record rather than about the file
    /// (`CONTEXT.md`, degrade-down).
    func isExternal(_ shortened: String) -> Bool {
        guard let cwd, !cwd.isEmpty else { return false }
        return shortened.hasPrefix("/") || shortened.hasPrefix("~") || shortened.hasPrefix("..")
    }

    /// This machine's home, so a path OUTSIDE the Session's tree still loses the part of itself
    /// that is about the machine rather than about the file.
    private static let home = FileManager.default.homeDirectoryForCurrentUser.path
}
