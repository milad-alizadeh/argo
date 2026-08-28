import Foundation

/// The seam a POLL reads a listing through: one resolved Binding in, its Tickets out.
///
/// Separate from `TicketPort` because an adapter is handed a scope and a grant, which do not say
/// which provider issued them — and a GitHub token sent to Linear is the one outcome worth ruling
/// out at the type level (#371).
public protocol TicketReading: Sendable {
    func list(through binding: ResolvedBinding) async throws -> [Ticket]
}
