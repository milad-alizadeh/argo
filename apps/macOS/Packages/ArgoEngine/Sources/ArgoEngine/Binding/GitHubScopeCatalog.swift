import Foundation

/// Which repositories can this GitHub Account be bound to?
///
/// Reads `/user/repos`, which is every repository the *token* can see — owned, collaborated on, and
/// reachable through an org — rather than only the ones the user owns. That breadth is the point:
/// the repository a Project sits in is very often somebody else's.
///
/// Sorted by `full_name` because the list is read as an alphabet, not as a feed. Paged to a ceiling
/// rather than to exhaustion: an identity on a large org can see thousands, and a menu is not a
/// place to put them. Hitting the ceiling is reported (`truncated`), never silently swallowed.
struct GitHubScopeCatalog: BindingScopeCatalog {
    /// One page is GitHub's own maximum, and three of them is the most a menu can be typed through.
    private static let pageSize = 100
    private static let pageLimit = 3

    private let transport: HTTPTransport

    init(transport: HTTPTransport) {
        self.transport = transport
    }

    func scopes(for query: ScopeQuery) async -> ScopeCatalogue {
        var names: [String] = []
        do {
            for page in 1 ... Self.pageLimit {
                let repositories = try await repositories(page: page, in: query)
                names += repositories.filter { $0.serves(query.port) }.map(\.fullName)
                // A short page is the last page — GitHub's own end-of-list signal, and the one that
                // costs no extra request to read.
                guard repositories.count == Self.pageSize else {
                    return .listed(names, truncated: false)
                }
            }
            return .listed(names, truncated: true)
        } catch HTTPTransportError.unauthorized {
            return .unauthorized
        } catch HTTPTransportError.rateLimited {
            return .unreadable("GitHub is rate-limiting this account. Try again in a few minutes.")
        } catch CatalogueError.unreadableBody {
            return .unreadable("GitHub answered with something Argo could not read.")
        } catch {
            return .unreadable("GitHub could not be reached.")
        }
    }

    private func repositories(page: Int, in query: ScopeQuery) async throws -> [GitHubRepository] {
        let data = try await transport.send(HTTPRequest(
            url: "\(GitHubOAuthApp.apiHost)/user/repos"
                + "?per_page=\(Self.pageSize)&page=\(page)&sort=full_name&direction=asc",
            bearerToken: query.grant.accessToken,
        ))
        // The same boundary parse `GitHubScopeCheck` makes: 4xx bodies come through this
        // transport deliberately, so the shape that came back is the answer.
        guard let repositories = try? GitHubRepository.decoder.decode(
            [GitHubRepository].self, from: data,
        ) else {
            throw CatalogueError.unreadableBody
        }
        return repositories
    }

    /// The one failure this reader raises itself, so the `catch` above reads as one list.
    private enum CatalogueError: Error {
        case unreadableBody
    }
}
