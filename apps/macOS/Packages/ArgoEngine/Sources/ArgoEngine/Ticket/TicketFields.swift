import Foundation

/// The prose of a ticket, as an edit names it. Each field is `nil` where the edit leaves it alone,
/// so "clear the body" and "do not touch the body" are never the same request.
public struct TicketFields: Equatable, Sendable {
    public let title: String?
    public let body: String?

    public init(title: String? = nil, body: String? = nil) {
        self.title = title
        self.body = body
    }
}
