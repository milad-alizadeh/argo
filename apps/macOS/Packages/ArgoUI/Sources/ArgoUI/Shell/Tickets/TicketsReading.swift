import ArgoEngine

/// Everything the Tickets room is derived from: the provider's own Tickets, plus the facts only
/// Argo holds.
///
/// A VALUE, and the room's whole input. Nothing under `TicketsRoom` reads a store, so a specimen
/// builds one of these from a fixture and gets the same room the app draws.
///
/// Every per-ticket fact the provider owns lives on the `Ticket` itself — status, labels,
/// priority, type, body and the edges (#820). What is left here is what no provider carries.
struct TicketsReading: Sendable {
    /// The provider's items in the order it served them, closed ones included: a parent's roll-up
    /// counts children the backlog does not draw.
    var items: [Ticket] = []
    /// Which items a Session has taken. DIRECT and Argo's alone — no provider carries a claim.
    var claimed: Set<Int> = []
    /// How many LIVE Sessions named no ticket, so `claimed` above is short by that many (#1074).
    /// `In progress` still counts, and says what it is short by.
    var claimsUnplaced: Int = 0
    /// How many LIVE Sessions nobody could have read a link for, no Ticket provider being bound.
    /// This one takes `In progress` absent: nothing was joined, so there is no answer to state.
    var claimsUnread: Int = 0
    /// What was read about each item's Delivery. Absent where nothing was read, which is a state
    /// of its own and not a quiet one (`DeliveryReading.absent`). Empty until a code host is read
    /// (#258), so every backlog dot is a hollow ring today.
    var deliveries: [Int: DeliveryReading] = [:]
    /// The Deliveries in flight on each item, in the code host's order. `deliveries` above is the
    /// one mark the backlog spends on a ticket; this is the list the ticket itself carries, and a
    /// ticket with two Deliveries has two entries here.
    var deliveryFacts: [Int: [DeliveryFacts]] = [:]
    /// The bound provider the sidebar's foot names. Absent while nothing is bound, and the foot
    /// goes with it rather than drawing an empty one.
    var provider: TicketsProvider?
    /// The Project the window is scoped to, by its own name. Read only by the room's vacancy pages,
    /// which name it — every other surface here is already inside one Project's window and would be
    /// repeating itself.
    var project: String?
    /// Which ticket the deck opens on.
    var showing: Int?
    /// What the bounded closed read answered, and `nil` until it has (#1075).
    ///
    /// The closed TICKETS themselves ride in `items` above, because a parent's roll-up counts
    /// children the backlog does not draw. What is left here is the two facts those items cannot
    /// carry: that an answer arrived at all — which is what keeps the `Closed` count absent rather
    /// than zero — and whether the provider has another page behind them.
    var closedListing: ClosedListingReading?

    struct ClosedListingReading: Sendable, Equatable {
        /// Which numbers the closed READ answered with — the `Closed` view's set, exactly.
        ///
        /// A closed ticket that arrived some other way is deliberately NOT in it. One followed by
        /// number (#895) is in `items` for the roll-up's sake, and putting it in the view too would
        /// make the count a different claim: `50 tickets` has to mean the listing, not the listing
        /// plus whatever links the reader happened to open.
        let numbers: Set<Int>
        /// Whether the provider served a cursor for the page behind these.
        let hasMore: Bool
    }

    var claims: TicketClaims {
        TicketClaims(numbers: claimed, unplaced: claimsUnplaced, unread: claimsUnread)
    }

    /// The same reading, opened on another ticket. A specimen selecting a child re-derives the room
    /// rather than mutating it, which is what keeps the room a value.
    func opened(at number: Int?) -> TicketsReading {
        var next = self
        next.showing = number
        return next
    }
}
