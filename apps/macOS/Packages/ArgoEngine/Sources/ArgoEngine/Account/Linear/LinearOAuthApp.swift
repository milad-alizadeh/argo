import Foundation

/// The registered OAuth App this binary authorizes to Linear as.
///
/// **PKCE with a loopback redirect, not a device flow.** Linear serves no device authorization
/// endpoint, so the settled mechanism for a desktop binary is the other one ADR-0018 names:
/// authorization code + PKCE, where `client_secret` is optional and the challenge is what proves
/// the exchange belongs to the request. The client id is public by construction on the same terms
/// GitHub's is.
public enum LinearOAuthApp {
    /// Empty until the app is registered at Linear, which is a human act and not a build step.
    /// `ConnectReading.authorizableToday` reads `isRegistered` rather than naming Linear outright,
    /// so the panel offers the grant the day this is filled in and not before — a button whose
    /// only outcome is a refusal is worse than no button (#371).
    public static let clientID = ""

    public static var isRegistered: Bool {
        !clientID.isEmpty
    }

    /// `read` and `write` are the two the Ticket port needs — the listing and the eight write
    /// intents. `issues:create` is not asked for separately: Linear folds it into `write`.
    public static let scopes = ["read", "write"]

    /// The loopback the browser is sent back to. A fixed port, because a redirect URI is registered
    /// ahead of time and cannot carry whichever one was free.
    public static let redirectPort: UInt16 = 51734
    public static let redirectURI = "http://127.0.0.1:\(redirectPort)/linear/callback"

    static let authorizeEndpoint = "https://linear.app/oauth/authorize"
    static let tokenEndpoint = "https://api.linear.app/oauth/token"
}
