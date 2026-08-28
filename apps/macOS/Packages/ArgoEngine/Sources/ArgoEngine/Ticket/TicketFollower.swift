import Foundation

/// Reading ONE ticket the number a link named, end to end: resolve the Project's Binding, pick the
/// adapter that speaks its provider, read, and keep what came back (#895).
///
/// The read half's twin of `TicketCreator`, and the only route to a closed ticket — a poll's
/// listing is open-only, so nothing else brings one in.
///
/// **One ticket per link a reader followed**, never a sweep: a number the listing already holds is
/// the poll's and is not re-read. The adapter still spends what that one ticket costs it, which on
/// GitHub is the issue plus a request for each edge its own summary declares
/// (`GitHubTickets.ticket(_:in:grant:)`).
public struct TicketFollower: Sendable {
    private let bindings: ProjectBindings
    private let items: TicketLedger
    private let health: ConnectionHealthLedger
    private let reads: TicketReading

    public init(
        bindings: ProjectBindings,
        items: TicketLedger,
        health: ConnectionHealthLedger,
        reads: TicketReading = ProviderTickets(),
    ) {
        self.bindings = bindings
        self.items = items
        self.health = health
        self.reads = reads
    }

    /// It answers nothing: the listing the ticket lands in is the answer, the way
    /// `TicketCreator.create` leaves the filed ticket in the ledger rather than in the caller's
    /// hand.
    public func follow(_ number: Int, forProject projectID: String?) async {
        guard let projectID,
              await !items.items(of: projectID).contains(where: { $0.number == number }),
              case let .ready(binding) = await bindings.resolve(port: .ticket, for: projectID)
        else { return }
        do {
            // A provider that answered and has nothing behind the number establishes a fact about
            // the NUMBER and none about the Binding, so it records no health and keeps nothing.
            guard let item = try await reads.ticket(number: number, through: binding)
            else { return }
            await items.follow(item, for: projectID)
        } catch {
            // A read that established nothing is the other half of that distinction, and it IS
            // evidence about the Binding — swallowing it would leave the chip claiming a
            // connection nobody has checked since.
            await health.record(
                error as? ProviderFetchError ?? .unreachable,
                of: PortReadTarget(binding: binding, projectID: projectID),
            )
        }
    }
}
