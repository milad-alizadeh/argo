import ArgoEngine

/// Everything the Tickets room is derived from: the provider's own Tickets, plus the facts only
/// Argo holds.
///
/// A VALUE, and the room's whole input. Nothing under `TicketsRoom` reads a store, so a specimen
/// builds one of these from a fixture and gets the same room the app draws.
///
/// Every per-ticket fact the provider owns lives on the `Ticket` itself — status, labels,
/// priority, type, body and the edges (#820). What is left here is what no provider carries.
/// `Equatable` because it is `TicketsRoomMemo`'s stamp: the whole reading is what the room is
/// derived from, so comparing it whole is what makes a remembered room impossible to serve for a
/// listing that has moved. A field added below joins the stamp by construction.
package struct TicketsReading: Sendable, Equatable {
    /// The provider's items in the order it served them, closed ones included: a parent's roll-up
    /// counts children the backlog does not draw.
    package var items: [Ticket] = []
    /// Which items a Session has taken, and how short that answer is (#894, #1074). DIRECT and
    /// Argo's alone — no provider carries a claim.
    ///
    /// One value rather than the set beside its own two shortfalls: `In progress` counts what it
    /// can and states what it could not place, so the three are never read apart.
    package var claims = TicketClaims(numbers: [])
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
    package var project: String?
    /// Which ticket the deck opens on.
    package var showing: Int?
    /// What the bounded closed read answered, and `nil` until it has (#1075).
    ///
    /// The closed TICKETS themselves ride in `items` above, because a parent's roll-up counts
    /// children the backlog does not draw. What is left here is the two facts those items cannot
    /// carry: that an answer arrived at all — which is what keeps the `Closed` count absent rather
    /// than zero — and whether the provider has another page behind them.
    package var closedListing: ClosedListingReading?

    package struct ClosedListingReading: Sendable, Equatable {
        /// Which numbers the closed READ answered with — the `Closed` view's set, exactly.
        ///
        /// A closed ticket that arrived some other way is deliberately NOT in it. One followed by
        /// number (#895) is in `items` for the roll-up's sake, and putting it in the view too would
        /// make the count a different claim: `50 tickets` has to mean the listing, not the listing
        /// plus whatever links the reader happened to open.
        let numbers: Set<Int>
        /// Whether the provider served a cursor for the page behind these.
        let hasMore: Bool

        /// Spelled out because Swift synthesises no memberwise initializer above
        /// `internal`, and the specimens build this from their own target (#1085).
        package init(numbers: Set<Int>, hasMore: Bool) {
            self.numbers = numbers
            self.hasMore = hasMore
        }
    }

    /// The same reading, opened on another ticket. A specimen selecting a child re-derives the room
    /// rather than mutating it, which is what keeps the room a value.
    package func opened(at number: Int?) -> TicketsReading {
        var next = self
        next.showing = number
        return next
    }

    /// Spelled out because Swift synthesises no memberwise initializer above
    /// `internal`, and the specimens build this from their own target (#1085).
    package init(
        items: [Ticket] = [],
        claims: TicketClaims = TicketClaims(numbers: []),
        deliveries: [Int: DeliveryReading] = [:],
        deliveryFacts: [Int: [DeliveryFacts]] = [:],
        provider: TicketsProvider? = nil,
        project: String? = nil,
        showing: Int? = nil,
        closedListing: ClosedListingReading? = nil,
    ) {
        self.items = items
        self.claims = claims
        self.deliveries = deliveries
        self.deliveryFacts = deliveryFacts
        self.provider = provider
        self.project = project
        self.showing = showing
        self.closedListing = closedListing
    }
}
