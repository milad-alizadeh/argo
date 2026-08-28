@testable import ArgoEngine
import Foundation
import Testing

/// Linear's authorization code + PKCE grant, which is the mechanism ADR-0018 leaves per-provider:
/// Linear serves no device endpoint, so the browser carries the exchange and a loopback catches it.
@Suite("Linear authorization")
struct LinearAuthorizationTests {
    /// A redirect that already happened, so the flow can be exercised without a socket.
    struct CaughtRedirect: LinearRedirectListening, LinearRedirectWait {
        let query: [String: String]
        let refusal: LinearAuthorizationError?
        /// Whether the port could be taken at all, which is the failure that must surface BEFORE
        /// the browser opens rather than after the user has granted access.
        let claimable: Bool

        init(
            _ query: [String: String] = [:],
            refusal: LinearAuthorizationError? = nil,
            claimable: Bool = true,
        ) {
            self.query = query
            self.refusal = refusal
            self.claimable = claimable
        }

        func claim() throws(LinearAuthorizationError) -> LinearRedirectWait {
            guard claimable else { throw LinearAuthorizationError.redirectUnavailable }
            return self
        }

        func awaitRedirect() async throws(LinearAuthorizationError) -> [String: String] {
            if let refusal {
                throw refusal
            }
            return query
        }
    }

    /// A request whose parts are stated rather than generated, so the half of the flow that runs
    /// AFTER the browser comes back is exercised whether or not an OAuth App is registered.
    private static func request(
        _ caught: CaughtRedirect,
    )
        -> LinearAuthorizationRequest {
        var request = LinearAuthorizationRequest(
            authorizationURL: URL(string: "https://linear.app/oauth/authorize")
                ?? .temporaryDirectory,
            verifier: "the-verifier",
            state: "the-state",
        )
        request.wait = caught
        return request
    }

    @Test
    func `an unregistered build refuses to begin rather than sending a browser nowhere`() throws {
        // The one input this cannot invent. A grant begun without a client id would send the user
        // to a Linear page that refuses the request in Linear's own words rather than Argo's.
        try #require(!LinearOAuthApp.isRegistered, "an id was registered; drop this expectation")

        #expect(throws: LinearAuthorizationError.notRegistered) {
            try LinearOAuthFlow(transport: StubProviderAPI()).requestAuthorization()
        }
    }

    @Test
    func `a port another Argo holds refuses before the browser is ever opened`() throws {
        // The ordering is the whole point. `requestAuthorization` is what the caller opens the
        // browser on, so the port has to be claimed inside it — claimed at the WAIT instead, this
        // would refuse only after the user had already granted access, with nothing left to do.
        try #require(!LinearOAuthApp.isRegistered, "an id was registered; rewrite this test")

        let flow = LinearOAuthFlow(
            transport: StubProviderAPI(), redirects: CaughtRedirect(claimable: false),
        )

        // Unregistered, so it refuses one step earlier still — and either way it refuses BEFORE
        // anything is opened, which is what this pins.
        #expect(throws: (any Error).self) {
            try flow.requestAuthorization()
        }
    }

    @Test
    func `the challenge is the verifier's SHA-256, never the verifier itself`() {
        // RFC 7636's own worked example. `plain` would make the challenge the secret it exists to
        // protect, so S256 is the only method offered.
        let verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"

        #expect(
            LinearAuthorizationRequest.challenge(for: verifier)
                == "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
        )
    }

    @Test
    func `a redirect carrying another request's state is refused, never exchanged`() async {
        // It is a request Argo did not make, whatever it carries — and the code is not spent
        // finding out.
        let api = StubProviderAPI()
        let caught = CaughtRedirect(["code": "abc", "state": "somebody-else's"])
        let flow = LinearOAuthFlow(transport: api, redirects: caught)

        await #expect(throws: LinearAuthorizationError.stateMismatch) {
            try await flow.awaitGrant(for: Self.request(caught))
        }
        #expect(await api.urls().isEmpty)
    }

    @Test
    func `a user who declined is Linear's own word, not a timeout`() async {
        let caught = CaughtRedirect([
            "error": "access_denied", "error_description": "The user said no.",
        ])
        let flow = LinearOAuthFlow(transport: StubProviderAPI(), redirects: caught)

        await #expect(throws: LinearAuthorizationError.refused("The user said no.")) {
            try await flow.awaitGrant(for: Self.request(caught))
        }
    }

    @Test
    func `a browser that never came back is abandoned rather than refused`() async {
        let caught = CaughtRedirect(refusal: .abandoned)
        let flow = LinearOAuthFlow(transport: StubProviderAPI(), redirects: caught)

        await #expect(throws: LinearAuthorizationError.abandoned) {
            try await flow.awaitGrant(for: Self.request(caught))
        }
    }

    @Test
    func `the exchange reads Linear's own snake-cased token keys`() async throws {
        // The one shape in this adapter that does NOT go through `LinearAPI.decoder`. Read wrongly
        // it fails as "Argo could not read Linear's answer" on a grant the user did approve.
        let token = """
        { "access_token": "lin_oauth_abc", "refresh_token": "lin_refresh_xyz",
          "expires_in": 86400, "scope": "read,write" }
        """
        let api = StubProviderAPI(body: token)
        let caught = CaughtRedirect(["code": "the-code", "state": "the-state"])
        let flow = LinearOAuthFlow(transport: api, redirects: caught)

        let grant = try await flow.awaitGrant(for: Self.request(caught))

        #expect(grant.accessToken == "lin_oauth_abc")
        #expect(grant.refreshToken == "lin_refresh_xyz")
        #expect(grant.scopes == ["read", "write"])
        // Linear's token expires in 24 hours, where GitHub's does not expire at all — the
        // per-provider lifecycle ADR-0018 predicted, and why `expiresAt` was left optional.
        #expect(grant.expiresAt != nil)
        #expect(!grant.isExpired(asOf: Date()))
    }

    @Test
    func `the verifier is sent and no client secret ever is`() async throws {
        let api = StubProviderAPI(body: #"{ "access_token": "t", "expires_in": 86400 }"#)
        let caught = CaughtRedirect(["code": "the-code", "state": "the-state"])
        let flow = LinearOAuthFlow(transport: api, redirects: caught)

        _ = try await flow.awaitGrant(for: Self.request(caught))
        let sent = try #require(await api.formBodies().first)

        // PKCE's whole point: the verifier proves this exchange belongs to the request that was
        // authorized, so a distributed binary needs no secret it cannot keep (ADR-0018).
        #expect(sent["code_verifier"] == "the-verifier")
        #expect(sent["code"] == "the-code")
        #expect(sent["client_secret"] == nil)
    }

    @Test
    func `the identity is read from Linear, so one identity authorized twice is one Account`(
    ) async throws {
        let viewer = """
        { "data": { "viewer": {
            "id": "user-7", "name": "Milad", "email": "milad@example.com" } } }
        """

        let account = try await LinearOAuthFlow(transport: StubProviderAPI(body: viewer))
            .identity(with: .linear)

        #expect(account.provider == .linear)
        #expect(account.providerAccountID == "user-7")
        #expect(account.displayName == "Milad")
    }

    @Test
    func `an identity with no name is told apart by its email, never by its id`() async throws {
        let viewer = #"{ "data": { "viewer": { "id": "user-7", "email": "m@example.com" } } }"#

        let account = try await LinearOAuthFlow(transport: StubProviderAPI(body: viewer))
            .identity(with: .linear)

        // An Account row has to be tellable from another on the same provider, and a UUID is not
        // a reading.
        #expect(account.displayName == "m@example.com")
    }

    @Test
    func `a redirect's query is read off the request line the browser sends`() {
        let line = "GET /linear/callback?code=a%2Fb&state=xyz HTTP/1.1"

        // Percent-decoded, because an authorization code is base64url and a state can carry one.
        #expect(
            LinearRedirectCatcher.query(of: line) == ["code": "a/b", "state": "xyz"],
        )
    }

    @Test
    func `a redirect with no query at all reads as nothing rather than as a code`() {
        #expect(LinearRedirectCatcher.query(of: "GET /linear/callback HTTP/1.1").isEmpty)
    }
}
