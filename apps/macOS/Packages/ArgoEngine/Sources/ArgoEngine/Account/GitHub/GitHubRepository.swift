import Foundation

/// One repository as GitHub answers it, and whether it can source what a port reads.
///
/// `fullName` doubles as the proof this is a repository and not GitHub's error body — an error body
/// has no `id` either, but a future one might, and a repository without an `owner/repo` name is not
/// a thing GitHub returns.
struct GitHubRepository: Decodable, Equatable, Sendable {
    let fullName: String
    let hasIssues: Bool

    /// The decoder both readers use, so a repository parsed at bind time and one offered before it
    /// cannot disagree about the same JSON.
    static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return decoder
    }()

    /// A repository with Issues switched off is visible and sources no Work Items, which after bind
    /// time is indistinguishable from a repository nobody has filed anything in. The code-host port
    /// asks nothing further: PRs, checks and reviews are on every repository there is.
    func serves(_ port: AccountPort) -> Bool {
        switch port {
        case .workItem: hasIssues
        case .codeHost: true
        }
    }
}
