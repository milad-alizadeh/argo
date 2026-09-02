@testable import ArgoEngine
import Testing

/// The listing behind the panel's repository picker. It reads the same shape `BindingScopeCheck`
/// does and answers in the same three ways, so a picker that offers nothing and one that could not
/// be read are never the same claim (#821).
@Suite("Binding scope catalogue")
struct BindingScopeCatalogTests {
    private static func query(port: AccountPort = .ticket) -> ScopeQuery {
        ScopeQuery(
            port: port,
            provider: .github,
            grant: AccountGrant(accessToken: "ghu_personal", scopes: ["repo"]),
        )
    }

    /// `full_name` is what a Binding is spelled with, so it is what comes back — not the bare name,
    /// which is ambiguous across owners.
    @Test
    func `the repositories a token can see are listed by their full name`() async {
        let api = StubProviderAPI(body: """
        [{ "full_name": "milad/argo", "has_issues": true },
         { "full_name": "trili/cockpit", "has_issues": true }]
        """)

        let catalogue = await ProviderScopeCatalog(transport: api).scopes(for: Self.query())

        #expect(catalogue == .listed(["milad/argo", "trili/cockpit"], truncated: false))
        #expect(await api.bearerTokens() == ["ghu_personal"])
    }

    /// The same rule the check makes at bind time, made one step earlier: a repository that cannot
    /// source Tickets is never offered under the port that reads them.
    @Test
    func `a repository with Issues switched off is not offered for the Ticket port`() async {
        let api = StubProviderAPI(body: """
        [{ "full_name": "milad/argo", "has_issues": false },
         { "full_name": "trili/cockpit", "has_issues": true }]
        """)

        let catalog = ProviderScopeCatalog(transport: api)

        #expect(await catalog.scopes(for: Self.query()) == .listed(
            ["trili/cockpit"],
            truncated: false,
        ))
    }

    /// PRs, checks and reviews are on every repository there is.
    @Test
    func `the code host port is offered every repository, Issues or not`() async {
        let api = StubProviderAPI(body: #"[{ "full_name": "milad/argo", "has_issues": false }]"#)

        let catalog = ProviderScopeCatalog(transport: api)
        let catalogue = await catalog.scopes(for: Self.query(port: .codeHost))

        #expect(catalogue == .listed(["milad/argo"], truncated: false))
    }

    /// An empty list is a real answer — this account can see nothing — and is deliberately NOT the
    /// shape a failed read takes.
    @Test
    func `an account that can see nothing answers with an empty listing`() async {
        let api = StubProviderAPI(body: "[]")

        let catalogue = await ProviderScopeCatalog(transport: api).scopes(for: Self.query())

        #expect(catalogue == .listed([], truncated: false))
    }

    /// A refused token is an Account-level failure, not "this account can see nothing" — the
    /// recovery is authorizing again, and an empty picker would send the user looking for a
    /// repository that is there.
    @Test
    func `a refused token is unauthorized rather than an empty list`() async {
        let api = StubProviderAPI(failure: .unauthorized(code: 401, reason: nil))

        let catalogue = await ProviderScopeCatalog(transport: api).scopes(for: Self.query())

        #expect(catalogue == .unauthorized)
    }

    /// GitHub throttles with the same 403 it refuses a token with, and only the headers tell them
    /// apart. Collapsed together, a user who has to wait is sent through an OAuth round-trip that
    /// fixes nothing.
    @Test
    func `a rate limit says to wait rather than to authorize again`() async {
        let api = StubProviderAPI(failure: .rateLimited)

        let catalogue = await ProviderScopeCatalog(transport: api).scopes(for: Self.query())

        #expect(catalogue ==
            .unreadable("GitHub is rate-limiting this account. Try again in a few minutes."))
    }

    /// An error body is not a listing. Read as one it would empty the picker on a read that never
    /// landed — the false DIRECT the degrade-down rule exists to refuse.
    @Test
    func `a body that is not a listing is unreadable, never an empty one`() async {
        let api = StubProviderAPI(body: #"{ "message": "Bad credentials" }"#)

        let catalogue = await ProviderScopeCatalog(transport: api).scopes(for: Self.query())

        guard case .unreadable = catalogue else {
            Issue.record("an error body listed as scopes: \(catalogue)")
            return
        }
    }

    /// A full page means there may be more. Ceilinged rather than exhausted — an identity on a
    /// large org can see thousands — and the ceiling is REPORTED, or it is a repository the user
    /// cannot find with no reason given.
    @Test
    func `a listing that hits the ceiling says it was cut short`() async {
        let page = (1 ... 100)
            .map { #"{ "full_name": "org/repo\#($0)", "has_issues": true }"# }
            .joined(separator: ",")
        let api = StubProviderAPI(body: "[\(page)]")

        let catalogue = await ProviderScopeCatalog(transport: api).scopes(for: Self.query())

        guard case let .listed(scopes, truncated) = catalogue else {
            Issue.record("a full page did not list: \(catalogue)")
            return
        }
        #expect(truncated)
        #expect(scopes.count == 300)
    }

    /// Linear has no grant flow yet (#371), so no Account of it exists to list. Answered rather
    /// than crashed if one ever is: an empty picker would claim the workspace holds nothing.
    @Test
    func `a provider with no listing behind it says so rather than offering nothing`() async {
        let api = StubProviderAPI(body: "[]")
        let query = ScopeQuery(
            port: .ticket,
            provider: .linear,
            grant: AccountGrant(accessToken: "lin_api", scopes: []),
        )

        let catalogue = await ProviderScopeCatalog(transport: api).scopes(for: query)

        guard case .unreadable = catalogue else {
            Issue.record("Linear offered a listing it cannot make: \(catalogue)")
            return
        }
    }
}
