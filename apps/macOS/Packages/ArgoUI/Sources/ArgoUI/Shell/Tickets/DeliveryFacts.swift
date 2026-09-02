import Foundation

/// One Delivery as the ticket carries it. `DeliveryReading` is the other grain — one mark over the
/// whole ticket, which is all the backlog spends.
package struct DeliveryFacts: Sendable, Equatable, Identifiable {
    /// The code host's own name for it — `argo#812`, repository included, verbatim.
    let name: String
    let branch: String
    let added: Int
    let removed: Int
    let checks: ChecksReading
    /// The code host's page for it, and `nil` where the host gave none — the chip then draws as a
    /// fact rather than as a control that would open nothing.
    let url: URL?

    package var id: String {
        name
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(
        name: String,
        branch: String,
        added: Int,
        removed: Int,
        checks: ChecksReading,
        url: URL?,
    ) {
        self.name = name
        self.branch = branch
        self.added = added
        self.removed = removed
        self.checks = checks
        self.url = url
    }
}

/// What the code host said about a Delivery's checks.
package enum ChecksReading: Sendable, Equatable, CaseIterable {
    case passing
    case failing
    /// Nothing was read: the chip leaves the slot empty rather than claiming a pass
    /// (`CONTEXT.md` L2 · Honesty tier).
    case unread
}
