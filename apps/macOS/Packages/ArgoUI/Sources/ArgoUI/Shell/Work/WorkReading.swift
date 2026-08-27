import ArgoEngine

/// Everything the Work room is derived from: the provider's own Work Items, plus the facts only
/// Argo holds.
///
/// A VALUE, and the room's whole input. Nothing under `WorkRoom` reads a store, so a specimen
/// builds one of these from a fixture and gets the same room the app draws.
///
/// Every per-ticket fact the provider owns lives on the `WorkItem` itself — status, labels,
/// priority, type, body and the edges (#820). What is left here is what no provider carries.
struct WorkReading: Sendable {
    /// The provider's items in the order it served them, closed ones included: a parent's roll-up
    /// counts children the backlog does not draw.
    var items: [WorkItem] = []
    /// Which items a Session has taken. DIRECT and Argo's alone — no provider carries a claim.
    var claimed: Set<Int> = []
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
    var provider: WorkProvider?
    /// The Project the window is scoped to, by its own name. Read only by the room's vacancy pages,
    /// which name it — every other surface here is already inside one Project's window and would be
    /// repeating itself.
    var project: String?
    /// Which ticket the deck opens on.
    var showing: Int?

    /// The same reading, opened on another ticket. A specimen selecting a child re-derives the room
    /// rather than mutating it, which is what keeps the room a value.
    func opened(at number: Int?) -> WorkReading {
        var next = self
        next.showing = number
        return next
    }
}
