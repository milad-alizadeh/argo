import Foundation

/// Linear's authorization code + PKCE grant: send the browser, catch the redirect, exchange the
/// code, then ask who the token belongs to.
///
/// The counterpart of `GitHubDeviceFlow`, and two calls for the same reason — `begin` hands back
/// what the user must be shown before anything waits on it.
public struct LinearOAuthFlow: Sendable {
    private let transport: HTTPTransport
    private let redirects: LinearRedirectListening

    public init(transport: HTTPTransport = URLSessionTransport()) {
        self.init(transport: transport, redirects: LinearRedirectCatcher())
    }

    init(transport: HTTPTransport, redirects: LinearRedirectListening) {
        self.transport = transport
        self.redirects = redirects
    }

    /// The port is claimed HERE, before the caller sends anyone anywhere. A second Argo already
    /// holding it refuses now, with nothing granted — where claiming it at the wait would refuse
    /// only after the user had approved, and there would be nothing left to do about it.
    public func requestAuthorization() throws(LinearAuthorizationError)
        -> LinearAuthorizationRequest {
        guard var request = LinearAuthorizationRequest() else {
            throw LinearAuthorizationError.notRegistered
        }
        request.wait = try redirects.claim()
        return request
    }

    /// Wait out the redirect and exchange what it carried.
    ///
    /// The state is checked before the code is spent: a redirect Argo did not ask for is refused
    /// rather than exchanged, whatever it carries.
    public func awaitGrant(
        for request: LinearAuthorizationRequest,
    ) async throws(LinearAuthorizationError)
        -> AccountGrant {
        guard let wait = request.wait else { throw LinearAuthorizationError.redirectUnavailable }
        let redirect = try await wait.awaitRedirect()
        if let refusal = redirect["error"] {
            throw LinearAuthorizationError.refused(redirect["error_description"] ?? refusal)
        }
        guard redirect["state"] == request.state else {
            throw LinearAuthorizationError.stateMismatch
        }
        guard let code = redirect["code"] else {
            throw LinearAuthorizationError.malformedResponse
        }
        return try await exchange(code, verifier: request.verifier)
    }

    /// Who this grant belongs to, read from Linear rather than guessed — the same identity
    /// authorized twice has to be one Account.
    public func identity(with grant: AccountGrant) async throws(LinearAuthorizationError)
        -> AccountRecord {
        let viewer = LinearOperation("query Viewer { viewer { id name email } }")
        let call = LinearCall(transport: transport)
        let payload: ViewerPayload
        do {
            payload = try await call.payload(viewer, grant: grant)
        } catch let failure {
            throw Self.identityFailure(failure)
        }
        return AccountRecord(
            provider: .linear,
            providerAccountID: payload.viewer.id,
            // The name where Linear holds one, and the email where it does not: an Account row has
            // to be tellable from another on the same provider, and an id is not a reading.
            displayName: payload.viewer.name ?? payload.viewer.email ?? payload.viewer.id,
        )
    }

    private func exchange(
        _ code: String, verifier: String,
    ) async throws(LinearAuthorizationError)
        -> AccountGrant {
        // Form-encoded, per the OAuth spec, and with no `client_secret` — the verifier is what
        // proves this exchange belongs to the request that was authorized.
        let request = HTTPRequest(url: LinearOAuthApp.tokenEndpoint, form: [
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": LinearOAuthApp.redirectURI,
            "client_id": LinearOAuthApp.clientID,
            "code_verifier": verifier,
        ])
        let data: Data
        do {
            data = try await transport.send(request)
        } catch {
            throw LinearAuthorizationError.malformedResponse
        }
        if let refusal = try? JSONDecoder().decode(TokenRefusal.self, from: data) {
            throw LinearAuthorizationError.refused(refusal.errorDescription ?? refusal.error)
        }
        guard let token = try? JSONDecoder().decode(TokenReply.self, from: data) else {
            throw LinearAuthorizationError.malformedResponse
        }
        return token.grant()
    }

    /// A refused grant reads as a refusal; everything else established nothing about it.
    private static func identityFailure(_ failure: LinearFailure) -> LinearAuthorizationError {
        switch failure.fetchError {
        case .grantRefused: .refused("Linear refused the token it had just issued.")
        case .offline, .rateLimited, .unreachable: .malformedResponse
        }
    }

    private struct ViewerPayload: Decodable {
        let viewer: Viewer

        struct Viewer: Decodable {
            let id: String
            let name: String?
            let email: String?
        }
    }

    /// Linear's token reply. The OAuth exchange is snake-cased on the wire and does not go through
    /// `LinearAPI.decoder`, which is GraphQL's — so the keys are named here, as `TokenRefusal`
    /// below names its own.
    private struct TokenReply: Decodable {
        let accessToken: String
        let refreshToken: String?
        /// Seconds, and absent on a token that does not expire — which Linear's do not answer
        /// with, but a shape read as required is a shape one field's absence breaks entirely.
        let expiresIn: Double?
        let scope: String?

        enum CodingKeys: String, CodingKey {
            case accessToken = "access_token"
            case refreshToken = "refresh_token"
            case expiresIn = "expires_in"
            case scope
        }

        func grant(now: Date = Date()) -> AccountGrant {
            AccountGrant(
                accessToken: accessToken,
                scopes: scope?.split(separator: ",").map(String.init) ?? LinearOAuthApp.scopes,
                lifetime: expiresIn.map {
                    .expiring(at: now.addingTimeInterval($0), refreshToken: refreshToken)
                } ?? .nonExpiring,
            )
        }
    }

    private struct TokenRefusal: Decodable {
        let error: String
        let errorDescription: String?

        enum CodingKeys: String, CodingKey {
            case error
            case errorDescription = "error_description"
        }
    }
}
