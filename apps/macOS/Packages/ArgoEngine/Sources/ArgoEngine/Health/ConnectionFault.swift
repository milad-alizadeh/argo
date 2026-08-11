import Foundation

/// Which of the two things has failed — and therefore how many Bindings go down with it and how
/// many acts it takes to fix.
///
/// This is the distinction the account level added. While a provider had one grant on a machine,
/// "the GitHub connection is down" was one fact and the two levels were a modelling nicety; a
/// provider has N identities now, so a revoked work-GitHub grant and a renamed repository differ in
/// both blast radius and remedy, and collapsing them would take a personal-GitHub Project down with
/// a work one.
public enum ConnectionLevel: Equatable, Sendable {
    /// The grant. Every Binding naming that Account is down together, and reconnecting is **one**
    /// act rather than one per Project.
    case account
    /// One port of one Project. The Account is fine, and every other Binding naming it still reads.
    case binding
}

/// What is failing, at which level.
///
/// A fault is what gets recorded; `ConnectionState` is what gets rendered. Keeping them apart is
/// what lets the level survive the projection: the two states are the failure spec's whole
/// vocabulary and neither of them carries a level, so a surface that only stored the state could no
/// longer say whether one reconnect or one rebind is the fix.
public enum ConnectionFault: Equatable, Sendable {
    /// The provider refused the grant itself: expired, or revoked from its own screen.
    case grantRefused
    /// A read that did not land, in the cause words. Binding-level even when the provider is
    /// entirely down: nothing has been said about the grant, so nothing may claim it needs one.
    case read(ConnectionCause)

    public var level: ConnectionLevel {
        switch self {
        case .grantRefused: .account
        case .read: .binding
        }
    }
}
