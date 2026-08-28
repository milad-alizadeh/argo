import Foundation

/// Authorizing a Linear identity, end to end: the act "Connect Linear" performs.
///
/// The counterpart of `GitHubAuthorization`, and the same two calls — `begin` returns what the
/// user must be shown, and only `complete` waits.
public struct LinearAuthorization: Sendable {
    private let flow: LinearOAuthFlow
    private let accounts: AccountRegistryStore

    public init(flow: LinearOAuthFlow = LinearOAuthFlow(), accounts: AccountRegistryStore) {
        self.flow = flow
        self.accounts = accounts
    }

    public func begin() throws -> LinearAuthorizationRequest {
        try flow.requestAuthorization()
    }

    /// Wait out the grant and record the Account it belongs to. Who the identity is comes from
    /// Linear, so the same identity authorized twice is one Account.
    @discardableResult
    public func complete(_ request: LinearAuthorizationRequest) async throws -> AccountRecord {
        let grant = try await flow.awaitGrant(for: request)
        let account = try await flow.identity(with: grant)
        try await accounts.authorize(account, grant: grant)
        return account
    }
}
