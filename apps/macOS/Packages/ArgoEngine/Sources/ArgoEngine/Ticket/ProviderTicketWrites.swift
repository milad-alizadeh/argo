import Foundation

/// Routes a Ticket WRITE to the adapter that speaks the Binding's provider — the write-side twin
/// of `ProviderTickets`, and exhaustive over `AccountProvider` for the same reason: a third
/// provider fails the build here rather than shipping a create that silently goes nowhere.
///
/// It hands back a port rather than being one: `TicketWriting.surface` takes no Binding, and a
/// router has no adapter to answer for until one names it.
public struct ProviderTicketWrites: Sendable {
    private let github: TicketWriting
    private let linear: TicketWriting

    public init(transport: HTTPTransport = URLSessionTransport()) {
        self.github = GitHubTickets(transport: transport)
        self.linear = LinearTickets(transport: transport)
    }

    public func port(of provider: AccountProvider) -> TicketWriting {
        switch provider {
        case .github: github
        case .linear: linear
        }
    }

    /// The writer for one Binding, over the ledger the room draws from and the health the chip
    /// reads.
    public func writer(
        for binding: ResolvedBinding, items: TicketLedger, health: ConnectionHealthLedger,
    )
        -> TicketWriter {
        TicketWriter(port: port(of: binding.provider), items: items, health: health)
    }
}
