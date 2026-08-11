import ArgoEngine
import Foundation

/// A device flow part-way through: the code the user has to type, and where to type it.
///
/// It is on screen for exactly as long as the grant is waiting, which is the whole reason
/// `GitHubDeviceFlow` hands its challenge back before it starts polling. A panel that spun on a
/// code it was holding would be asking the user to finish something they cannot read.
///
/// The device code itself is absent by construction: it is Argo's half of the exchange, and a
/// value that cannot carry it cannot show it.
public struct ConnectChallenge: Equatable, Sendable {
    public let provider: AccountProvider
    /// The provider's own formatting, rendered verbatim: what is shown has to match what is typed.
    public let userCode: String
    public let verificationURL: URL

    public init(provider: AccountProvider, userCode: String, verificationURL: URL) {
        self.provider = provider
        self.userCode = userCode
        self.verificationURL = verificationURL
    }
}
