import Foundation

/// One Delivery as the ticket carries it — a bordered object, never a row in a list
/// (`cockpit-work-room.md` — the ticket detail). Two Deliveries on one ticket are two of these.
///
/// The backlog's own signal is `DeliveryReading`, one mark over the whole ticket. This is the other
/// grain: what a reader gets once they have opened the thing the mark was standing for.
struct DeliveryFacts: Sendable, Equatable, Identifiable {
    /// The code host's own name for it — `argo#812`, repository included. Verbatim, so a Delivery
    /// raised against a fork reads as itself rather than as a bare number that could be anyone's.
    let name: String
    let branch: String
    let added: Int
    let removed: Int
    let checks: ChecksReading
    /// Where the chip deep-links: the code host's own page for this Delivery, and `nil` where the
    /// host gave none. A Delivery Argo has no page for is still a Delivery, so the chip goes quiet
    /// rather than absent — and it stops being a control, because a control that opens nothing is
    /// worse than a fact that stays put.
    let url: URL?

    var id: String {
        name
    }
}

/// What the code host said about a Delivery's checks.
enum ChecksReading: Sendable, Equatable, CaseIterable {
    case passing
    case failing
    /// Nothing was read. The chip says nothing rather than claiming a pass — degrade-down
    /// (`CONTEXT.md` L2 · Honesty tier), and a silent green is the one reading worth ruling out.
    case unread
}
