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
                url: "https://api.github.com/repos/\(probe.scope)",
                bearerToken: probe.grant.accessToken,
            ))
            let decoder = JSONDecoder()
            decoder.keyDecodingStrategy = .convertFromSnakeCase
            guard (try? decoder.decode(RepositoryResponse.self, from: data)) != nil else {
                return .notVisible
            }
            return .visible
        } catch HTTPTransportError.unauthorized {
            return .unauthorized
        } catch {
            return .unreadable("GitHub could not be reached")
        }
    }

    /// The one field that proves this is a repository and not GitHub's error body. `fullName` and
    /// not `id`, because an error body has no `id` either but a future one might; a repository
    /// without an `owner/repo` name is not a thing GitHub returns.
    private struct RepositoryResponse: Decodable {
        let fullName: String
    }
}
