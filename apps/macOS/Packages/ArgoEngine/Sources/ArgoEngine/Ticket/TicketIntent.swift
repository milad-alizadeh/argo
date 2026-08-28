import Foundation

/// One change the cockpit asks a Ticket provider for, said canonically rather than in the
/// provider's own shape (#167, `CONTEXT.md` → Ports).
///
/// Creating a ticket is not here because it has no ticket to be applied to — it is
/// `TicketWriting.create`, and the two together are the eight the port declares over.
public enum TicketIntent: Equatable, Sendable {
    case updateFields(TicketFields)
    case transitionTo(TicketCanonicalState)
    case addBlockedBy(Int)
    case removeBlockedBy(Int)
    case setParent(Int)
    /// Detach from a NAMED parent: a Ticket carries its children and never its parent, so the
    /// number is the caller's to supply — and it has it, because it drew the edge it is cutting.
    case removeParent(Int)
    case addLabel(String)
    case removeLabel(String)
    /// The provider's own priority word, and `nil` to clear it.
    case setPriority(String?)
    case close(TicketCloseReason)
    case reopen

    /// Which declared write this intent asks for, so a caller can ask whether it is offered at all
    /// before it composes a payload.
    public var write: TicketWrite {
        switch self {
        case .updateFields: .updateFields
        case .transitionTo: .transition
        case .addBlockedBy, .removeBlockedBy: .blockedBy
        case .setParent, .removeParent: .parent
        case .addLabel, .removeLabel: .labels
        case .setPriority: .priority
        case .close, .reopen: .closure
        }
    }
}
