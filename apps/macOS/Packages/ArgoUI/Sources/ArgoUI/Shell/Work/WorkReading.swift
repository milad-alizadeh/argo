import ArgoEngine

/// Everything the Work room is derived from: the provider's own Work Items, plus the four facts
/// only Argo holds.
///
/// A VALUE, and the room's whole input. Nothing under `WorkRoom` reads a store, so a specimen
/// builds one of these from a fixture and gets the same room the app draws.
struct WorkReading: Sendable {
    /// The provider's items in the order it served them, closed ones included: a parent's roll-up
    /// counts children the backlog does not draw.
    var items: [WorkItem] = []
    /// Which items a Session has taken. DIRECT and Argo's alone — no provider carries a claim.
    var claimed: Set<Int> = []
    /// What was read about each item's Delivery. Absent where nothing was read, which is a state
    /// of its own and not a quiet one (`DeliveryReading.absent`).
    var deliveries: [Int: DeliveryReading] = [:]
    /// The Deliveries in flight on each item, in the code host's order. `deliveries` above is the
    /// one mark the backlog spends on a ticket; this is the list the ticket itself carries, and a
    /// ticket with two Deliveries has two entries here.
    var deliveryFacts: [Int: [DeliveryFacts]] = [:]
    /// The provider's own priority word per item, verbatim. Not a `WorkItem` field: no port reads a
    /// priority yet (#388), and a fact nobody has read is ABSENT rather than defaulted to a middle
    /// rung nothing said.
    var priorities: [Int: String] = [:]
    /// The provider's own type word, on the same terms. A property rather than a rung of a ladder
    /// (#160), so it sits beside the other facts and never orders them.
    var types: [Int: String] = [:]
    /// A ticket's body, verbatim. Not a `WorkItem` field: Argo stores the link, never the content
    /// (`CONTEXT.md` L1 · Work Item), so the body arrives beside the item that was opened.
    var bodies: [Int: String] = [:]
    /// The PRD-shaped parents the `CHARTS` group lists, in the order it lists them.
    var charts: [Int] = []
    /// The bound provider the sidebar's foot names. Absent while nothing is bound, and the foot
    /// goes with it rather than drawing an empty one.
    var provider: WorkProvider?
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
