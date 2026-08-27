import Foundation

/// Can this GitHub Account see this repository?
///
/// One read of `/repos/{owner}/{repo}`, and the answer is which shape came back rather than which
/// status code did: GitHub answers an invisible repository with a 404 whose body is an error
/// message, and `URLSessionTransport` hands 4xx bodies through deliberately — the device flow's
/// `authorization_pending` arrives as one. So the repository is visible exactly when the response
/// decodes as a repository, which is the same boundary parse `GitHubDeviceFlow` makes.
///
/// A private repository invisible to *this* token and one that does not exist are the same 404 by
/// design — GitHub will not confirm the existence of what you cannot see. Both are `notVisible`,
/// and neither is worth a guess at which it was.
struct GitHubScopeCheck: BindingScopeCheck {
    private let transport: HTTPTransport

    init(transport: HTTPTransport) {
        self.transport = transport
    }

    func visibility(of probe: BindingProbe) async -> ScopeVisibility {
        do {
            let data = try await transport.send(HTTPRequest(
                url: "\(GitHubOAuthApp.apiHost)/repos/\(probe.scope)",
                bearerToken: probe.grant.accessToken,
            ))
            let decoder = JSONDecoder()
            decoder.keyDecodingStrategy = .convertFromSnakeCase
            guard let repository = try? decoder.decode(RepositoryResponse.self, from: data) else {
                return .notVisible
            }
            return Self.serves(probe.port, repository) ? .visible : .notVisible
        } catch HTTPTransportError.unauthorized {
            return .unauthorized
        } catch {
            return .unreadable("GitHub could not be reached")
        }
    }

    /// A repository with Issues switched off is visible and sources no Work Items, which after bind
    /// time is indistinguishable from a repository nobody has filed anything in. The code-host port
    /// asks nothing further: PRs, checks and reviews are on every repository there is.
    private static func serves(_ port: AccountPort, _ repository: RepositoryResponse) -> Bool {
        switch port {
        case .workItem: repository.hasIssues
        case .codeHost: true
        }
    }

    /// `fullName` proves this is a repository and not GitHub's error body — an error body has no
    /// `id` either, but a future one might, and a repository without an `owner/repo` name is not a
    /// thing GitHub returns.
    private struct RepositoryResponse: Decodable {
        let fullName: String
        let hasIssues: Bool
    }
}
