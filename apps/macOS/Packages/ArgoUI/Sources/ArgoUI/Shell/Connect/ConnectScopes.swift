import ArgoEngine

/// A port's scope picker, open on one Account: what the provider was asked, and what it said.
///
/// One value on the reading rather than `@State` on the row, for the reason `AccountsCoordinator`
/// gives about every other act on this panel — a row that held its own pending choice would be
/// drawing what it hoped had happened. It also makes the panel's *own* act and the one the grant
/// flow performs on its behalf the same act: authorizing lands here too, so a fresh identity opens
/// its picker without the row being told twice.
public struct ConnectScopes: Equatable, Sendable {
    /// What the provider said, in the shapes the picker draws.
    public enum State: Equatable, Sendable {
        case loading
        /// The scopes offered, and whether the provider had more than the read returned.
        case listed([String], truncated: Bool)
        /// Why nothing can be offered. Deliberately not a fallback to typing: a scope typed past a
        /// failed read is a guess, and this panel exists to stop guessing (#821).
        case unreadable(String)
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
