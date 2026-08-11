import Foundation

/// The connection a recorded Binding's fault is, where it is one at all.
///
/// This is how the chip is right about an expired grant before anything has polled: `resolve`
/// already reads the registries and the keychain, so a token that has gone is observable on the
/// spot rather than after a read fails somewhere the user is not looking.
///
/// Two of the four faults map to nothing, and that is the point of mapping at all. A row naming an
/// Account that was removed, or a provider that cannot fill the port, is a decision to remake — the
/// Connect panel says so on the row, with a fix. Routing them into the chip as well would give one
/// repair two voices, which is exactly the second failure language this ticket refuses to coin.
public extension BindingFault {
    var connectionFault: ConnectionFault? {
        switch self {
        case .grantExpired, .grantMissing: .grantRefused
        case .accountRemoved, .portNotServedByProvider: nil
        }
    }
}
