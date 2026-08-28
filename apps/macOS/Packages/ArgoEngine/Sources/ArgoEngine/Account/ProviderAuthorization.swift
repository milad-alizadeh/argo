import Foundation

/// What the user has to do to finish a grant, whichever provider issues it.
///
/// The two flows differ in exactly one fact, and it is this one: GitHub hands back a code to TYPE
/// at a fixed address, Linear hands back a page to APPROVE. Both are "open this and come back", so
/// the panel draws one card and reads the code as absent rather than switching on the provider.
public struct ProviderChallenge: Equatable, Sendable {
    public let provider: AccountProvider
    /// The provider's own formatting, rendered verbatim, and `nil` for a redirect flow — where the
    /// browser carries the whole exchange and a code to copy would be an invented step.
    public let userCode: String?
    public let url: URL
    /// Whether Argo should open the page itself. True for a redirect: the user pressed Connect,
    /// and a second control to reach the page they just asked for is a step nobody needs.
    public let opensItself: Bool
}

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
                userCode: asked.userCode,
                url: asked.verificationURL,
                // GitHub's address is short, fixed and part of the instruction, so the user reads
                // it and goes there. Opening it for them would take the window while they are
                // still reading the code they have to bring.
                opensItself: false,
            )
        case let .linear(asked):
            ProviderChallenge(
                provider: .linear,
                userCode: nil,
                url: asked.authorizationURL,
                opensItself: true,
            )
        }
    }
}
