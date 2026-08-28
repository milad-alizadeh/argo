import Foundation

/// Authorizing one identity with whichever provider was chosen — the act "Connect…" performs.
///
/// The fourth place a new provider has to appear, beside `ProviderScopeCheck`,
/// `ProviderScopeCatalog` and `ProviderWorkItems`, and exhaustive over `AccountProvider` for the
/// same reason: a third provider fails the build here rather than shipping a menu item that does
/// nothing when pressed.
///
/// Two calls, like both flows underneath: `begin` returns what the user must be shown, and only
/// `complete` waits.
public struct ProviderAuthorization: Sendable {
    private let github: GitHubAuthorization
    private let linear: LinearAuthorization

    public init(accounts: AccountRegistryStore) {
        self.github = GitHubAuthorization(accounts: accounts)
        self.linear = LinearAuthorization(accounts: accounts)
    }

    public func begin(_ provider: AccountProvider) async throws -> ProviderGrantInFlight {
        switch provider {
        case .github: try await .github(github.begin())
        case .linear: try .linear(linear.begin())
        }
    }

    /// Wait out the grant and record the Account it belongs to.
    @discardableResult
    public func complete(_ asked: ProviderGrantInFlight) async throws -> AccountRecord {
        switch asked {
        case let .github(challenge): try await github.complete(challenge)
        case let .linear(request): try await linear.complete(request)
        }
    }
}

/// One grant part-way through, in the shape its own provider's flow needs to finish it.
///
/// The provider's half is carried opaquely — a device code and a PKCE verifier are both Argo's own
/// secret, and neither ever reaches a surface. What a surface reads is `challenge`.
public enum ProviderGrantInFlight: Sendable {
    case github(GitHubDeviceChallenge)
    case linear(LinearAuthorizationRequest)

    public var challenge: ProviderChallenge {
        switch self {
        case let .github(asked):
            ProviderChallenge(
                provider: .github,
                kind: .typed(code: asked.userCode),
                url: asked.verificationURL,
            )
        case let .linear(asked):
            ProviderChallenge(provider: .linear, kind: .redirect, url: asked.authorizationURL)
        }
    }
}
