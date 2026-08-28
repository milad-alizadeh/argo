import CryptoKit
import Foundation

/// One authorization in flight: where to send the browser, and the two secrets that prove the
/// exchange afterwards belongs to this request.
///
/// The counterpart of `GitHubDeviceChallenge`, and handed back before anything waits for the same
/// reason: the browser has to be open before the loopback is listened on.
public struct LinearAuthorizationRequest: Equatable, Sendable {
    /// Where the user authorizes. Opened in their browser, never rendered as a code to type —
    /// Linear has no device flow, so there is nothing to type.
    public let authorizationURL: URL
    /// Argo's half of the exchange, never shown: the verifier the challenge in the URL was made
    /// from.
    let verifier: String
    /// The one-time value the callback must echo. What makes a redirect arriving from anywhere
    /// else a refusal rather than a grant.
    let state: String

    /// `nil` where the app is not registered, which is the one input this cannot invent.
    public init?() {
        guard LinearOAuthApp.isRegistered else { return nil }
        let verifier = Self.randomToken()
        let state = Self.randomToken()
        guard let url = Self.authorization(verifier: verifier, state: state) else { return nil }
        self.init(authorizationURL: url, verifier: verifier, state: state)
    }

    /// The parts stated rather than generated, for the suite that exercises what happens AFTER the
    /// browser comes back — which does not depend on an OAuth App being registered.
    init(authorizationURL: URL, verifier: String, state: String) {
        self.authorizationURL = authorizationURL
        self.verifier = verifier
        self.state = state
    }

    private static func authorization(verifier: String, state: String) -> URL? {
        var components = URLComponents(string: LinearOAuthApp.authorizeEndpoint)
        components?.queryItems = [
            URLQueryItem(name: "client_id", value: LinearOAuthApp.clientID),
            URLQueryItem(name: "redirect_uri", value: LinearOAuthApp.redirectURI),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "scope", value: LinearOAuthApp.scopes.joined(separator: ",")),
            URLQueryItem(name: "state", value: state),
            URLQueryItem(name: "code_challenge", value: challenge(for: verifier)),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
        ]
        return components?.url
    }

    /// The S256 challenge: the verifier's SHA-256, base64url without padding. `plain` is not
    /// offered — it makes the challenge the secret it was meant to protect.
    static func challenge(for verifier: String) -> String {
        base64URL(Data(SHA256.hash(data: Data(verifier.utf8))))
    }

    /// 32 bytes of the system's own randomness, base64url — comfortably inside RFC 7636's 43-to-128
    /// character range for a verifier, and the same shape serves as the state.
    private static func randomToken() -> String {
        base64URL(Data((0 ..< 32).map { _ in UInt8.random(in: .min ... .max) }))
    }

    private static func base64URL(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

/// Why an authorization did not produce an Account.
public enum LinearAuthorizationError: Error, Equatable {
    /// No OAuth App is registered in this build, so there is nothing to authorize as.
    case notRegistered
    /// The loopback could not be listened on — another process holds the port, most often Argo
    /// itself in another window.
    case redirectUnavailable
    /// The user closed the browser, or the wait was stopped.
    case abandoned
    /// A redirect arrived whose `state` is not the one that was sent. Refused rather than
    /// exchanged: it is a request Argo did not make.
    case stateMismatch
    /// Linear refused, in its own words — `access_denied` when the user declines, and whatever
    /// else its error body carries.
    case refused(String)
    /// Linear answered with something that is not the documented shape. Never guessed past.
    case malformedResponse
}
