import Foundation

/// The registered OAuth App this binary authorizes as.
///
/// The client id is public by construction — a distributed desktop binary cannot hold a secret, and
/// the device flow is chosen precisely because it needs none (ADR-0018 / #367). Shipping it in the
/// source is the intended posture, not an oversight.
public enum GitHubOAuthApp {
    /// PLACEHOLDER — the OAuth App is not registered yet (#566). The grant round-trip cannot be
    /// verified against GitHub until a real id lands here, and that verification is what the
    /// ticket owes the PR. Nothing else in this file changes when it does.
    public static let clientID = "Iv1.ARGO_CLIENT_ID_UNREGISTERED"

    /// `repo` is the settled scope (ADR-0018). `read:project` rides along now rather than forcing
    /// every user through a second consent screen the day GitHub Projects lands — the consent is
    /// the expensive part, not the scope.
    ///
    /// An org that restricts OAuth Apps can refuse `repo` outright. That is a finding to report,
    /// not something to route around, which is why `AccountGrant` records what was *granted*.
    public static let scopes = ["repo", "read:project"]

    /// Held as strings because that is what `HTTPRequest` takes: `URL(string:)` is failable, and a
    /// constant that has to be unwrapped at every call site buys nothing over one guard inside the
    /// transport.
    static let deviceCodeEndpoint = "https://github.com/login/device/code"
    static let accessTokenEndpoint = "https://github.com/login/oauth/access_token"
    static let userEndpoint = "https://api.github.com/user"
}
