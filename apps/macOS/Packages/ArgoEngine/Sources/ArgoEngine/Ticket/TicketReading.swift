import Foundation

/// The seam a POLL reads a listing through: one resolved Binding in, its Tickets out.
///
/// Separate from `TicketPort` because an adapter is handed a scope and a grant, which do not say
/// which provider issued them — and a GitHub token sent to Linear is the one outcome worth ruling
/// out at the type level (#371).
public protocol TicketReading: Sendable {
    func list(through binding: ResolvedBinding) async throws -> [Ticket]

    /// One Ticket by number, on `TicketPort.ticket(number:in:grant:)`'s terms — `nil` where the
    /// provider answered and has nothing behind it (#895).
    func ticket(number: Int, through binding: ResolvedBinding) async throws -> Ticket?
}
