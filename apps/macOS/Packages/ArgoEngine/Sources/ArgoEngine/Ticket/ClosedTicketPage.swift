import Foundation

/// One page of a Project's CLOSED Tickets, and whether the provider has another behind it (#1075).
///
/// The closed set is unbounded where the open one is not, so it is read a page at a time.
public struct ClosedTicketPage: Equatable, Sendable {
    /// The page's Tickets, in the order the provider served them — which both adapters sort by
    /// `updatedAt` descending, so the page boundary and the row order are the same order.
    public let items: [Ticket]
    /// What the NEXT page is asked for, and `nil` where the provider served the last one. Opaque
    /// and provider-shaped: GitHub's is a page number, Linear's is an `endCursor`.
    public let next: String?

    public init(items: [Ticket], next: String? = nil) {
        self.items = items
        self.next = next
    }

    /// How many closed Tickets one page holds. One request on both providers — GitHub takes it as
    /// `per_page`, and Linear's own connection ceiling is twice it.
    public static let size = 50

    /// The page a provider that served nothing answered with — no items, and no page behind it.
    public static let empty = ClosedTicketPage(items: [], next: nil)
}
