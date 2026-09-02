import ArgoEngine

extension TicketsView {
    /// What a view's count rests on having been READ. A view whose ground was not read counts
    /// absent rather than short (`TicketsRoomProjection.views`), because a number that has
    /// silently dropped what nobody asked about is worse than no number.
    ///
    /// One reading per view rather than a predicate per ground, so a sixth view has to say which
    /// of the four it is instead of inheriting whichever predicate answers false.
    enum Ground: Equatable, Sendable {
        /// Every open ticket answers it, so nothing can be missing from the count.
        case nothing
        /// The provider's dependency edges (#820).
        case edges
        /// The roster join — which live Session is on which ticket (#894). Read wherever a
        /// provider was bound to join AGAINST: a live Session that named no ticket leaves the
        /// count short rather than unread, and the view says so beside it (#1074).
        case claims
        /// The bounded closed listing, which is read only when its own view is opened (#1075).
        /// Until it has answered the count is absent rather than zero — opening onto `0` is the
        /// number that says "you have finished nothing", and nobody asked.
        case closedListing

        /// Whether this ground was read, given what was read of each.
        func isRead(given reads: Reads) -> Bool {
            switch self {
            case .nothing: true
            case .edges: reads.edges
            case .claims: reads.claims
            case .closedListing: reads.closedListing
            }
        }
    }

    /// What was read of each ground, so a view's count asks one question of one value — and a
    /// fifth ground lands here rather than as a fourth argument nobody can pass.
    struct Reads: Equatable, Sendable {
        /// Whether EVERY open ticket's edges were served: `Unblocked` and `Blocked` partition the
        /// open set, so the pair can only be counted where none of it is unread.
        let edges: Bool
        /// Whether every live Session's own link was read (#894).
        let claims: Bool
        /// Whether the closed read has answered for this Project at all.
        let closedListing: Bool
    }

    var ground: Ground {
        switch self {
        case .allOpen: .nothing
        case .unblocked, .blocked: .edges
        case .inProgress: .claims
        case .closed: .closedListing
        }
    }

    /// Whether this view holds this Ticket, out of the set the view is defined over
    /// (`TicketsView.source`). ONE predicate, used both to count a view in the sidebar and to fill
    /// the list beside it — the two asking the same question separately is how a rail comes to
    /// disagree with the rows it sits next to.
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
        // Every ticket of its own set, on `allOpen`'s terms — the READ is the filter here, because
        // the provider was asked for the closed listing and nothing else came back with it.
        case .closed: true
        }
    }
}
