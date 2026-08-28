import Foundation

/// Which teams can this Linear Account be bound to?
///
/// A Linear Binding's scope is a team (`CONTEXT.md` L1 · Binding), and a team is addressed by its
/// id rather than by its name — two workspaces can both have an `Engineering`. So the picker
/// offers the id, which is what `LinearScopeCheck` then validates and what the adapter reads with.
struct LinearScopeCatalog: BindingScopeCatalog {
    /// A workspace with more teams than this is not a menu problem Argo can solve by paging: the
    /// same ceiling `GitHubScopeCatalog` applies for the same reason.
    private static let pageSize = 100

    private let call: LinearCall

    init(transport: HTTPTransport) {
        self.call = LinearCall(transport: transport)
    }

    private static let document = """
    query Teams($first: Int!) {
      teams(first: $first, orderBy: createdAt) { nodes { id key name } }
    }
    """

    func scopes(for query: ScopeQuery) async -> ScopeCatalogue {
        do {
            let payload: Payload = try await call.payload(
                LinearOperation(Self.document, ["first": .int(Self.pageSize)]),
                grant: query.grant,
            )
            // Truncation is not reported: Linear serves no total beside the page, so claiming a
            // list is whole is a claim nothing here can make and claiming it is cut is another.
            return .listed(payload.teams.nodes.map(\.id), truncated: false)
        } catch {
            return Self.unreadable(error)
        }
    }

    private static func unreadable(_ failure: LinearFailure) -> ScopeCatalogue {
        switch failure.fetchError {
        case .grantRefused: .unauthorized
        case .rateLimited: .unreadable(
                "Linear is rate-limiting this account. Try again in a few minutes.",
            )
        case .offline, .unreachable: .unreadable("Linear could not be reached.")
        }
    }

    private struct Payload: Decodable {
        let teams: LinearNodes<Team>

        struct Team: Decodable {
            let id: String
        }
    }
}
