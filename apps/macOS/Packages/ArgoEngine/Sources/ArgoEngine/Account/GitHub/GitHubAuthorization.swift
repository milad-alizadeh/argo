import Foundation

/// Authorizing a GitHub identity, end to end: the act "Connect GitHub" performs.
///
/// The flow, the identity read and the registry only ever run in one order, and the token is stored
/// under the id the `/user` read returned, never under a guess.
///
/// Still two calls: `begin` returns what the user must be shown, and only `complete` waits.
public struct GitHubAuthorization: Sendable {
    private let flow: GitHubDeviceFlow
    private let accounts: AccountRegistryStore

    public init(flow: GitHubDeviceFlow = GitHubDeviceFlow(), accounts: AccountRegistryStore) {
        self.flow = flow
        self.accounts = accounts
    }

    public func begin() async throws -> GitHubDeviceChallenge {
        try await flow.requestChallenge()
    }

    /// Wait out the grant and record the Account it belongs to. Who the identity is comes from
    /// GitHub, so the same identity authorized twice is one Account.
    @discardableResult
    public func complete(_ challenge: GitHubDeviceChallenge) async throws -> AccountRecord {
        let grant = try await flow.awaitGrant(for: challenge)
        let account = try await flow.identity(with: grant)
        try await accounts.authorize(account, grant: grant)
        return account
    }
}
