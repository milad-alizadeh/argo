import Foundation

/// Where one Ticket is READ, on the provider's own site — the Binding's provider and scope, and
/// nothing else.
///
/// Argo stores the link and never the content (`CONTEXT.md` L1 · Ticket), so a browse URL is
/// derived rather than held: provider, plus scope, plus number. It routes to the port for the same
/// reason `ProviderTickets` does — the derivation is the adapter's, and a second provider proves
/// it there rather than in a branch here (#371).
///
/// `nil` is a first-class answer. A Binding whose scope cannot address an item has not failed; it
/// has said so, and the verbs that would open one go rather than standing there inert (#872).
public struct TicketAddress: Equatable, Sendable {
    public let provider: AccountProvider
    /// The Binding's own scope, opaque here as it is everywhere else — GitHub's `owner/repo`,
    /// Linear's team id.
    public let scope: String

    public init(provider: AccountProvider, scope: String) {
        self.provider = provider
        self.scope = scope
    }

    /// The Binding a read goes through, addressed. `nil` where the port is bound to nothing.
    public init?(binding: BindingResolution) {
        guard case let .ready(resolved) = binding else { return nil }
        self.init(provider: resolved.provider, scope: resolved.binding.scope)
    }

    /// Where a human reads this ticket, and `nil` where this Binding cannot say.
    ///
    /// Numbers below one are refused here rather than in each adapter: providers number Tickets
    /// from one, so a `#0` is a misread of a link and not a page anybody could open — the same rule
    /// `TicketLink` applies when it reads one off a branch.
    public func browseURL(of number: Int) -> URL? {
        guard number > 0 else { return nil }
        switch provider {
        case .github: return GitHubTickets.browseURL(of: number, in: scope)
        case .linear: return LinearTickets.browseURL(of: number, in: scope)
        }
    }

    /// Which Ticket of THIS Binding a URL addresses, and `nil` for every URL that addresses
    /// something else (#1178) — `browseURL(of:)` read backwards, routed to the same adapters.
    ///
    /// What the feed asks before it words a link as a Ticket.
    public func ticketNumber(of url: URL) -> Int? {
        switch provider {
        case .github: GitHubTickets.ticketNumber(of: url, in: scope)
        case .linear: LinearTickets.ticketNumber(of: url, in: scope)
        }
    }
}
