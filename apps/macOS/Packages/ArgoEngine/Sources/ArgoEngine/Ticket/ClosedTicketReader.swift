import Foundation

/// Reading a Project's CLOSED Tickets a page at a time, end to end: resolve the Binding, pick the
/// adapter that speaks its provider, read one page, and keep what came back (#1075).
///
/// Raised by the VIEW and never by a cadence — `open` when the reader opens it, `extend` when they
/// press `Load more`. There is no path to this read through `TicketPoll` at all.
public struct ClosedTicketReader: Sendable {
    private let bindings: ProjectBindings
    private let items: TicketLedger
    private let health: ConnectionHealthLedger
    private let reads: TicketReading

    public init(
        bindings: ProjectBindings,
        ledgers: TicketPoll.Ledgers,
        reads: TicketReading = ProviderTickets(),
    ) {
        self.bindings = bindings
        self.items = ledgers.items
        self.health = ledgers.health
        self.reads = reads
    }

    /// The first page, replacing whatever was held — what opening the view reads. It reads on every
    /// opening rather than once per launch: the answer goes stale, and the bound is what makes
    /// asking again cheap.
    public func open(forProject projectID: String?) async {
        await read(after: nil, forProject: projectID)
    }

    /// The page behind the one in hand, appended — what `Load more` reads.
    ///
    /// Nothing happens where no page has been opened yet, and nothing where the provider served the
    /// last one: a `Load more` that read the first page again would silently answer a different
    /// question than the row it sits under asks.
    public func extend(forProject projectID: String?) async {
        guard let projectID,
              let cursor = await items.closedListing(of: projectID)?.next
        else { return }
        await read(after: cursor, forProject: projectID)
    }

    /// One page. `after` is both the request and the decision of which end it lands on — a first
    /// page replaces, a later one appends — so the two acts above cannot drift into two reads.
    private func read(after cursor: String?, forProject projectID: String?) async {
        guard let projectID,
              case let .ready(binding) = await bindings.resolve(port: .ticket, for: projectID)
        else { return }
        do {
            let page = try await reads.closed(after: cursor, through: binding)
            if cursor == nil {
                await items.openClosed(page, for: projectID)
            } else {
                await items.extendClosed(page, for: projectID)
            }
        } catch {
            // A read that established nothing IS evidence about the Binding, on `TicketFollower`'s
            // terms: swallowing it would leave the chip claiming a connection nobody has checked
            // since. The listing is left where it was — a failed page must not blank a view that
            // was full a second ago, which is the poll's own rule.
            await health.record(
                error as? ProviderFetchError ?? .unreachable,
                of: PortReadTarget(binding: binding, projectID: projectID),
            )
        }
    }
}
