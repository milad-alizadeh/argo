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
}
