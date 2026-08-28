import ArgoEngine

extension TicketsView {
    /// Whether this view's answer rests on the dependency edges. The two that do cannot be counted
    /// at all where a ticket's edges were not served (`TicketsRoomProjection.views`).
    var restsOnEdges: Bool {
        switch self {
        case .unblocked, .blocked: true
        case .allOpen, .inProgress: false
        }
    }

    /// Whether this view holds an open Ticket. ONE predicate, used both to count a view in the
    /// sidebar and to fill the list beside it — the two asking the same question separately is how
    /// a rail comes to disagree with the rows it sits next to.
    ///
    /// `unblocked` and `blocked` are exact complements over the tickets whose edges were READ, so
    /// they partition that set. Only `clear` is unblocked, which puts a STRANDED item — its blocker
    /// ruled out, so the edge never satisfies — on the blocked side rather than between the two.
    ///
    /// A ticket whose edges nobody served is `unread`, and in NEITHER view (#820): only a provider
    /// SAYING there is nothing in the way makes a ticket unblocked, and only one naming an edge
    /// makes it blocked (`CONTEXT.md` L2 · degrade-down).
    func admits(_ item: Ticket, claimed: Bool) -> Bool {
        switch self {
        case .allOpen: true
        case .unblocked: item.blockage == .clear
        case .inProgress: claimed
        case .blocked: item.blockage == .blocked || item.blockage == .stranded
        }
    }
}
