import ArgoEngine
import Foundation

/// A grant part-way through: where the user has to finish it, and how.
///
/// It is on screen for exactly as long as the grant is waiting, which is why both flows hand their
/// challenge back before they start waiting. A panel that spun on something it was holding would
/// be asking the user to finish what they cannot read.
///
/// Argo's own half of either exchange — GitHub's device code, Linear's PKCE verifier — is absent by
/// construction: a value that cannot carry it cannot show it.
public struct ConnectChallenge: Equatable, Sendable {
    public let provider: AccountProvider
    /// A code to type, or a page to approve. The engine's own distinction, carried rather than
    /// re-derived from an optional at every place the card asks.
    public let kind: ProviderChallengeKind
    public let verificationURL: URL

    public init(
        provider: AccountProvider,
        kind: ProviderChallengeKind = .redirect,
        verificationURL: URL,
    ) {
        self.provider = provider
        self.kind = kind
        self.verificationURL = verificationURL
    }

    /// The engine's own value, narrowed to what a view may hold: `opensItself` is the app's to act
    /// on and never something a card draws.
    public init(_ challenge: ProviderChallenge) {
        self.init(
            provider: challenge.provider, kind: challenge.kind, verificationURL: challenge.url,
        )
    }

    /// The provider's own formatting, rendered verbatim: what is shown has to match what is typed.
    public var userCode: String? {
        guard case let .typed(code) = kind else { return nil }
        return code
    }
}
