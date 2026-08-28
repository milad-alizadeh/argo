import Foundation

/// The canonical state bucket a Ticket falls in, across every provider (#167).
///
/// **Never stored, and a bucket rather than a word.** The provider's own status word renders
/// verbatim (#272); this exists only where Argo has to compute or group across providers, which no
/// verbatim word can do.
///
/// Authority splits across the two inputs: closure is DERIVED per-port, and `claimed` is DIRECT,
/// because no provider carries a claim — Argo's own ledger is the only thing that knows a Session
/// took the ticket.
public enum TicketState: String, Equatable, Sendable, CaseIterable {
    case open
    case claimed
    case resolved
    case ruledOut

    /// Closure is the provider's answer and outranks Argo's, so a ticket closed while a Session
    /// still holds it reads closed rather than claimed.
    public init(closure: TicketClosure, claimed: Bool) {
        switch closure {
        case .open: self = claimed ? .claimed : .open
        case .resolved, .closedUnreadably: self = .resolved
        case .ruledOut: self = .ruledOut
        }
    }
}
