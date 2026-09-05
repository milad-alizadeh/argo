import Foundation

/// One of the nine canonical writes, named so a declaration can be read by machine.
///
/// The unit a capability is declared over, which is why `addBlockedBy` and `removeBlockedBy` are
/// one case: no provider offers half a dependency edge, and a control that could add but not clear
/// one would be a trap rather than an affordance.
public enum TicketWrite: String, Equatable, Sendable, CaseIterable {
    case create
    case updateFields
    case transition
    case blockedBy
    case parent
    case labels
    case priority
    case closure
    /// Removing the ticket outright (#1247). Not a closure: a closed ticket is still readable
    /// and still carries its history, and this leaves nothing of it on the provider at all.
    case delete
}
