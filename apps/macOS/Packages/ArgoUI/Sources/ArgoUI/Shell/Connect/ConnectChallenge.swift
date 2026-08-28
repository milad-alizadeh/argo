import ArgoEngine
import Foundation

/// A grant part-way through: where the user has to finish it, and the code to type where there is
/// one.
///
/// It is on screen for exactly as long as the grant is waiting, which is why both flows hand their
/// challenge back before they start waiting. A panel that spun on something it was holding would
/// be asking the user to finish what they cannot read.
///
/// Argo's own half of either exchange — GitHub's device code, Linear's PKCE verifier — is absent by
/// construction: a value that cannot carry it cannot show it.
public struct ConnectChallenge: Equatable, Sendable {
    public let provider: AccountProvider
    /// The provider's own formatting, rendered verbatim: what is shown has to match what is typed.
    ///
    /// `nil` for a REDIRECT flow, which is Linear's — the browser carries the whole exchange, so
    /// there is nothing to type and a card offering a code to copy would be inventing a step.
    public let userCode: String?
    public let verificationURL: URL

    public init(provider: AccountProvider, userCode: String? = nil, verificationURL: URL) {
        self.provider = provider
        self.userCode = userCode
        self.verificationURL = verificationURL
    }

    /// The engine's own value, narrowed to what a view may hold: `opensItself` is the app's to act
    /// on and never something a card draws.
    public init(_ challenge: ProviderChallenge) {
        self.init(
            provider: challenge.provider,
            userCode: challenge.userCode,
            verificationURL: challenge.url,
        )
    }
}
