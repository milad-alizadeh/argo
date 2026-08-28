import Foundation

/// What each Project's Ticket port last answered with, and the only place a listing lives.
///
/// **Nothing here is persisted** (ADR-0008): a launch that opened on yesterday's listing would be
/// a DIRECT-looking claim about a read it has not made. A listing is replaced whole or left alone,
/// never merged, which is what stops a failed poll emptying a room that was full a second ago.
public actor TicketLedger {
    private var listings: [String: [Ticket]] = [:]
    /// Tickets read one at a time, by a number a link named (#895). Kept apart from the listing
    /// because a poll replaces that whole and a closed ticket was never in it — a followed ticket
    /// is not the poll's to retire.
    private var followed: [String: [Int: Ticket]] = [:]

    public init() {}

    public func record(_ items: [Ticket], for projectID: String) {
        listings[projectID] = items
    }

    /// One ticket the provider has just answered about, taken as truth without waiting for the next
    /// tick (#257).
    ///
    /// The one place a listing is touched rather than replaced whole. It earns the exception the
    /// same way a poll does: the value came back from the PROVIDER, never from the click.
    public func adopt(_ item: Ticket, for projectID: String) {
        var listing = listings[projectID] ?? []
        let held = listing.firstIndex { $0.number == item.number }
        // A listing holds the OPEN tickets, so a ticket that closed leaves rather than lands.
        guard item.closure == .open else {
            if let held {
                listing.remove(at: held)
            }
            listings[projectID] = listing
            return
        }
        // In place where the ticket was already listed, so a write does not reorder the room around
        // the ticket the reader just acted on.
        if let held {
            listing[held] = item
        } else {
            listing.append(item)
        }
        listings[projectID] = listing
    }

    /// One ticket the provider answered about by number, because a link named it and the listing
    /// does not hold it. The value came back from the PROVIDER, never from the click.
    func follow(_ item: Ticket, for projectID: String) {
        followed[projectID, default: [:]][item.number] = item
    }

    /// The listing, and an empty one for a Project nothing has read yet — which reads the same as
    /// a repository with no issues, because from a surface's side they are the same: no Tickets
    /// to show, and the health chip is what says whether that is an answer or a silence.
    ///
    /// No Project at all reads empty on the same terms, and never the last one's listing: a window
    /// pointed away from a Project must not go on drawing its backlog.
    ///
    /// The tickets followed by number come after it, in their own numeric order. The listing WINS
    /// where both hold a number: it was read this tick, and a follow may be an hour old.
    public func items(of projectID: String?) -> [Ticket] {
        guard let projectID else { return [] }
        let listed = listings[projectID] ?? []
        let numbers = Set(listed.map(\.number))
        return listed + (followed[projectID] ?? [:]).values
            .filter { !numbers.contains($0.number) }
            .sorted { $0.number < $1.number }
    }
}
