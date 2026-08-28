@testable import ArgoEngine
import Foundation
import Testing

/// The two adapters that answer "can this identity see this scope", against recorded provider
/// bodies. Both read the shape rather than a status code, for the reason `URLSessionTransport`
/// hands 4xx bodies through: the device flow's own "pending" arrives as one.
@Suite("Binding scope checks")
struct BindingScopeCheckTests {
    private static func probe(
        provider: AccountProvider = .github,
        scope: String = "milad/argo",
        port: AccountPort = .ticket,
    )
        -> BindingProbe {
        BindingProbe(
            binding: ProjectBinding(port: port, accountID: "\(provider.rawValue):1", scope: scope),
            provider: provider,
            grant: AccountGrant(accessToken: "ghu_personal", scopes: ["repo"]),
        )
    }

    @Test
    func `a repository the token can read is visible`() async {
        let api =
            StubProviderAPI(body: #"{ "id": 1, "full_name": "milad/argo", "has_issues": true }"#)

        let visibility = await ProviderScopeCheck(transport: api).visibility(of: Self.probe())

        #expect(visibility == .visible)
        #expect(await api.urls() == ["https://api.github.com/repos/milad/argo"])
        #expect(await api.bearerTokens() == ["ghu_personal"])
    }

    /// GitHub answers a repository this token cannot see with the same 404 it answers one that does
    /// not exist. Both are `notVisible`, and neither is worth a guess at which it was.
    @Test
    func `a repository the token cannot see is not visible`() async {
        let api = StubProviderAPI(body: #"{ "message": "Not Found" }"#)

        let visibility = await ProviderScopeCheck(transport: api).visibility(of: Self.probe())

        #expect(visibility == .notVisible)
    }

    /// Visible and sourcing no Tickets are different things. After bind time a repository with
    /// Issues switched off is indistinguishable from one nobody has filed anything in, which is the
    /// silence the whole check exists to prevent.
    @Test
    func `a repository with Issues switched off cannot fill the Ticket port`() async {
        let api = StubProviderAPI(
            body: #"{ "id": 1, "full_name": "milad/argo", "has_issues": false }"#,
        )

        let check = ProviderScopeCheck(transport: api)

        #expect(await check.visibility(of: Self.probe(port: .ticket)) == .notVisible)
    }

    /// PRs, checks and reviews are on every repository there is, so the code-host port asks nothing
    /// beyond visibility.
    @Test
    func `a repository with Issues switched off still fills the code host port`() async {
        let api = StubProviderAPI(
            body: #"{ "id": 1, "full_name": "milad/argo", "has_issues": false }"#,
        )

        let check = ProviderScopeCheck(transport: api)

        #expect(await check.visibility(of: Self.probe(port: .codeHost)) == .visible)
    }

    @Test
    func `a refused token is an Account-level answer, not a scope one`() async {
        let api = StubProviderAPI(failure: .unauthorized(code: 401, reason: nil))

        let visibility = await ProviderScopeCheck(transport: api).visibility(of: Self.probe())

        #expect(visibility == .unauthorized)
    }

    @Test
    func `a provider that is down is unreadable rather than not visible`() async {
        let api = StubProviderAPI(failure: .status(code: 503))

        let visibility = await ProviderScopeCheck(transport: api).visibility(of: Self.probe())

        #expect(visibility == .unreadable("GitHub could not be reached"))
    }

    @Test
    func `a Linear team the token can read is visible`() async {
        let api = StubProviderAPI(body: #"{ "data": { "team": { "id": "TEAM-1" } } }"#)
        let probe = Self.probe(provider: .linear, scope: "TEAM-1")

        let visibility = await ProviderScopeCheck(transport: api).visibility(of: probe)

        #expect(visibility == .visible)
        #expect(await api.urls() == ["https://api.linear.app/graphql"])
    }

    /// Linear is GraphQL, so a team that cannot be seen is a 200 with a null `team` — a check that
    /// read the status code would call it visible.
    @Test
    func `a Linear team the token cannot see is not visible`() async {
        let api = StubProviderAPI(body: #"{ "data": { "team": null }, "errors": [] }"#)
        let probe = Self.probe(provider: .linear, scope: "TEAM-9")

        let visibility = await ProviderScopeCheck(transport: api).visibility(of: probe)

        #expect(visibility == .notVisible)
    }

    /// The team id travels as a variable, so a scope carrying a quote is a team that is not found
    /// rather than a query that means something else.
    @Test
    func `a Linear scope is sent as a variable, never spliced into the query`() async throws {
        let api = StubProviderAPI(body: #"{ "data": { "team": null } }"#)
        let hostile = #"TEAM-1") { viewer { id } } #"#
        let probe = Self.probe(provider: .linear, scope: hostile)

        _ = await ProviderScopeCheck(transport: api).visibility(of: probe)

        let data = try #require(await api.jsonBodies().first)
        let sent = try JSONDecoder().decode(LinearRequest.self, from: data)
        #expect(sent.query == "query Team($id: String!) { team(id: $id) { id } }")
        #expect(sent.variables["id"] == hostile)
    }

    private struct LinearRequest: Decodable {
        let query: String
        let variables: [String: String]
    }
}
