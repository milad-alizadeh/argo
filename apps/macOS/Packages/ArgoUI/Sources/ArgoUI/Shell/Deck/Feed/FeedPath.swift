import Foundation

/// Paths as the feed says them: relative to where the Session is working.
///
/// `/Users/milad/Developer/argo/.claude/worktrees/ticket-421/apps/macOS/…` is thirty characters of
/// this machine before the first character about the work. Inside a Session everything is relative
/// to that Session's own cwd, so the prefix says nothing a reader does not already know — and it is
/// the part that pushes the informative half of an address off the edge of the panel.
///
/// It shortens whatever it is given rather than parsing a path out of it, because a command line
/// carries paths too, in the middle of its own words.
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

    /// This machine's home, so a path OUTSIDE the Session's tree still loses the part of itself
    /// that is about the machine rather than about the file.
    private static let home = FileManager.default.homeDirectoryForCurrentUser.path
}
