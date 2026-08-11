import Foundation

/// Which ports a provider's grant can fill.
///
/// GitHub issues one grant that sources both intent and Delivery truth; Linear's sources intent
/// only (CONTEXT.md → Ports). It lives beside the Binding rather than on `AccountProvider` itself
/// because it is not a fact about the identity — it is the rule that decides whether a *choice* is
/// one the provider can honour.
extension AccountProvider {
    var ports: [AccountPort] {
        switch self {
        case .github: AccountPort.allCases
        case .linear: [.workItem]
        }
    }

    func serves(_ port: AccountPort) -> Bool {
        ports.contains(port)
    }
}
