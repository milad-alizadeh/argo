import Foundation

/// One Delivery as the ticket carries it. `DeliveryReading` is the other grain — one mark over the
/// whole ticket, which is all the backlog spends.
struct DeliveryFacts: Sendable, Equatable, Identifiable {
    /// The code host's own name for it — `argo#812`, repository included, verbatim.
    let name: String
    let branch: String
    let added: Int
    let removed: Int
    let checks: ChecksReading
    /// The code host's page for it, and `nil` where the host gave none — the chip then draws as a
    /// fact rather than as a control that would open nothing.
    let url: URL?

    var id: String {
        name
    }
}

/// What the code host said about a Delivery's checks.
enum ChecksReading: Sendable, Equatable, CaseIterable {
    case passing
    case failing
    /// Nothing was read: the chip leaves the slot empty rather than claiming a pass
    /// (`CONTEXT.md` L2 · Honesty tier).
    case unread
}
