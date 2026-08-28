import Foundation

/// One edge of a Ticket's `blockedBy` DAG, carrying the blocker's own closure (`CONTEXT.md`
/// L1 · Ticket).
///
/// The closure is on the edge because blockers are verified per-blocker: the provider's summary
/// counts open blockers only, so it cannot tell a cleared edge from a cancelled one.
public struct TicketBlocker: Equatable, Sendable {
    public let number: Int
    public let closure: TicketClosure

    public init(number: Int, closure: TicketClosure) {
        self.number = number
        self.closure = closure
    }
}

/// What a Ticket's blockers say about whether it can be picked up.
public enum TicketBlockage: Equatable, Sendable {
    case clear
    /// The provider served no dependency edges for this ticket, so nothing is known either way.
    /// Distinct from `clear`, which is a provider SAYING there is nothing in the way.
    case unread
    case blocked
    /// A blocker was ruled out, so the edge is neither satisfied nor waiting on anything: the
    /// premise was cancelled and a human has to re-scope one of the two.
    case stranded

    /// Stranded outranks blocked: a blocked ticket clears itself in time and a stranded one never
    /// will.
    public init(blockers: [TicketBlocker]) {
        if blockers.contains(where: { $0.closure == .ruledOut }) {
            self = .stranded
        } else if blockers.contains(where: { !$0.closure.satisfiesBlocker }) {
            self = .blocked
        } else {
            self = .clear
        }
    }
}
