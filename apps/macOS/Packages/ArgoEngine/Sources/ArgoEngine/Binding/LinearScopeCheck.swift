import Foundation

/// Can this Linear Account see this team?
///
/// One team's id and nothing else — the bind-time answer (#371), without which a Project bound to
/// a team this identity cannot see reads empty forever and looks like a team with no work in it.
///
/// Linear is GraphQL, so every answer is a 200 and the shape decides: a team that cannot be seen
/// comes back as `errors` with a null `data.team`, not as a status code.
struct LinearScopeCheck: BindingScopeCheck {
    private let transport: HTTPTransport

    init(transport: HTTPTransport) {
        self.transport = transport
    }

    func visibility(of probe: BindingProbe) async -> ScopeVisibility {
        guard let body = Self.query(teamID: probe.scope) else {
            return .unreadable("the team id could not be sent")
        }
        do {
            let data = try await transport.send(HTTPRequest(
                url: LinearAPI.endpoint,
                body: .json(body),
                bearerToken: probe.grant.accessToken,
            ))
            guard let response = try? JSONDecoder().decode(TeamResponse.self, from: data) else {
                return .notVisible
            }
            return response.data.team == nil ? .notVisible : .visible
        } catch HTTPTransportError.unauthorized {
            return .unauthorized
        } catch {
            return .unreadable("Linear could not be reached")
        }
    }

    /// The team id travels as a GraphQL variable rather than interpolated into the query, so a
    /// scope carrying a quote is a team that is not found and never a query that means something
    /// else.
    private static func query(teamID: String) -> Data? {
        try? JSONSerialization.data(withJSONObject: [
            "query": "query Team($id: String!) { team(id: $id) { id } }",
            "variables": ["id": teamID],
        ])
    }

    /// `data` is required and `team` optional, which is exactly the distinction being read: a body
    /// with no `data` at all is not Linear answering, while `data.team == nil` is Linear saying no.
    private struct TeamResponse: Decodable {
        struct Payload: Decodable {
            let team: Team?
        }

        struct Team: Decodable {
            let id: String
        }

        let data: Payload
    }
}
