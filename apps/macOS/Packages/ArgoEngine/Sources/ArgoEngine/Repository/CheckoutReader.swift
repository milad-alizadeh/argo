import Foundation

/// What a checkout is, read off git's answers: the repository a folder belongs to, and its HEAD as
/// a branch, a detached SHA, or nothing readable at all.
///
/// An actor because the app's adapter blocks on a subprocess and the caller is the main actor.
actor CheckoutReader {
    private let git: GitCommand

    init(git: @escaping GitCommand = gitCommand) {
        self.git = git
    }

    func read(at candidateURL: URL) -> CheckoutProjection {
        guard let root = gitValue(git, ["rev-parse", "--show-toplevel"], at: candidateURL) else {
            return CheckoutProjection(repositoryURL: candidateURL, head: .unavailable)
        }
        let repositoryURL = URL(fileURLWithPath: root).standardizedFileURL
        guard let branch = gitValue(git, ["rev-parse", "--abbrev-ref", "HEAD"], at: repositoryURL)
        else {
            return CheckoutProjection(repositoryURL: repositoryURL, head: .unavailable)
        }
        guard branch == "HEAD" else {
            return CheckoutProjection(repositoryURL: repositoryURL, head: .branch(branch))
        }
        guard let shortSHA = gitValue(git, ["rev-parse", "--short", "HEAD"], at: repositoryURL)
        else {
            return CheckoutProjection(repositoryURL: repositoryURL, head: .unavailable)
        }
        return CheckoutProjection(repositoryURL: repositoryURL, head: .detached(shortSHA: shortSHA))
    }
}
