import ArgoEngine

/// A port's scope picker, open on one Account: what the provider was asked, and what it said.
///
/// On the reading rather than in the row's `@State` so the grant flow can open one — authorizing
/// lands here too, and a fresh identity opens its picker without the row being told twice.
public struct ConnectScopes: Equatable, Sendable {
    /// What the provider said, in the shapes the picker draws.
    public enum State: Equatable, Sendable {
        case loading
        /// The scopes offered, and whether the provider had more than the read returned.
        case listed([String], truncated: Bool)
        /// The read failed. Never a fallback to typing: a scope typed past a failed read is a
        /// guess (#821).
        case unreadable(String)
        /// The grant itself was refused. Its own case because the repair differs: retrying reuses
        /// the same refused token and cannot succeed, so the picker offers authorizing again.
        case unauthorized
    }

    public let port: AccountPort
    public let accountID: String
    public let state: State

    public init(port: AccountPort, accountID: String, state: State) {
        self.port = port
        self.accountID = accountID
        self.state = state
    }
}
