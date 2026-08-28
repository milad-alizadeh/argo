@testable import ArgoEngine
import Foundation
import Testing

/// Linear's authorization code + PKCE grant, which is the mechanism ADR-0018 leaves per-provider:
/// Linear serves no device endpoint, so the browser carries the exchange and a loopback catches it.
@Suite("Linear authorization")
struct LinearAuthorizationTests {
    /// A redirect that already happened, so the flow can be exercised without a socket.
    struct CaughtRedirect: LinearRedirectListening {
        let query: [String: String]
        let refusal: LinearAuthorizationError?

        init(_ query: [String: String] = [:], refusal: LinearAuthorizationError? = nil) {
            self.query = query
            self.refusal = refusal
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
    private static let request = LinearAuthorizationRequest(
        authorizationURL: URL(string: "https://linear.app/oauth/authorize") ?? .temporaryDirectory,
        verifier: "the-verifier",
        state: "the-state",
    )

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
        let flow = LinearOAuthFlow(
            transport: api,
            redirects: CaughtRedirect(["code": "abc", "state": "somebody-else's"]),
        )

        await #expect(throws: LinearAuthorizationError.stateMismatch) {
            try await flow.awaitGrant(for: Self.request)
        }
        #expect(await api.urls().isEmpty)
    }

    @Test
    func `a user who declined is Linear's own word, not a timeout`() async {
        let flow = LinearOAuthFlow(
            transport: StubProviderAPI(),
            redirects: CaughtRedirect([
                "error": "access_denied", "error_description": "The user said no.",
            ]),
        )

        await #expect(throws: LinearAuthorizationError.refused("The user said no.")) {
            try await flow.awaitGrant(for: Self.request)
        }
    }

    @Test
    func `a browser that never came back is abandoned rather than refused`() async {
        let flow = LinearOAuthFlow(
            transport: StubProviderAPI(), redirects: CaughtRedirect(refusal: .abandoned),
        )

        await #expect(throws: LinearAuthorizationError.abandoned) {
            try await flow.awaitGrant(for: Self.request)
        }
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
