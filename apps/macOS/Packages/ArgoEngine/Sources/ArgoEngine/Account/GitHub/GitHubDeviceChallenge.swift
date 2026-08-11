import Foundation

/// What the user has to be shown while the grant waits: a code to type and where to type it.
///
/// Handed back *before* the flow starts polling, which is why the flow is two calls rather than
/// one (#265).
public struct GitHubDeviceChallenge: Equatable, Sendable {
    /// In GitHub's own formatting (`ABCD-1234`) — rendered verbatim, never re-spaced, because what
    /// is shown has to match what the user types.
    public let userCode: String
    public let verificationURL: URL
    /// Argo's half of the exchange, never shown: the secret pairing this poll with that code.
    public let deviceCode: String
    /// How often GitHub permits a poll, and how long the code stays good — both the provider's
    /// numbers, not Argo's.
    public let interval: Duration
    public let expiresIn: Duration

    public init(
        userCode: String,
        verificationURL: URL,
        deviceCode: String,
        interval: Duration,
        expiresIn: Duration,
    ) {
        self.userCode = userCode
        self.verificationURL = verificationURL
        self.deviceCode = deviceCode
        self.interval = interval
        self.expiresIn = expiresIn
    }
}

public enum GitHubDeviceFlowError: Error, Equatable {
    /// The provider answered with something that is not the documented shape. Never guessed past.
    case malformedResponse
    /// The user pressed Cancel on GitHub's own screen.
    case declined
    /// The code went stale before it was entered. Recoverable by asking for another one.
    case expired
    /// Any other refusal, carrying GitHub's own words — an org's OAuth-App policy blocking `repo`
    /// arrives here, and rewording it would lose the only thing that says how to fix it.
    case refused(code: String, description: String)
}
