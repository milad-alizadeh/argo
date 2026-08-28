import ArgoEngine

extension TicketsView {
    /// What a view's count rests on having been READ. A view whose ground was not read counts
    /// absent rather than short (`TicketsRoomProjection.views`), because a number that has
    /// silently dropped what nobody asked about is worse than no number.
    ///
    /// One reading per view rather than a predicate per ground, so a fifth view has to say which
    /// of the three it is instead of inheriting whichever predicate answers false.
    enum Ground: Equatable, Sendable {
        /// Every open ticket answers it, so nothing can be missing from the count.
        case nothing
        /// The provider's dependency edges (#820).
        case edges
        /// The roster join — which live Session is on which ticket (#894).
        case claims

        /// Whether this ground was read, given what was read of each.
        func isRead(edges: Bool, claims: Bool) -> Bool {
            switch self {
            case .nothing: true
            case .edges: edges
            case .claims: claims
            }
        }
    }

    var ground: Ground {
        switch self {
        case .allOpen: .nothing
        case .unblocked, .blocked: .edges
        case .inProgress: .claims
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
