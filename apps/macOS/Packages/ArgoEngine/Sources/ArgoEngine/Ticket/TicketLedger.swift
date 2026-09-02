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
    /// The bounded closed listing, a page at a time, and `nil` for a Project nobody has opened the
    /// `Closed` view on (#1075). Kept apart from the listing for the same reason `followed` is, and
    /// for one more: absent and empty are DIFFERENT answers here — the view counts absent until
    /// this exists, because opening onto `0` would claim the reader has finished nothing.
    private var closed: [String: ClosedListing] = [:]

    /// Everything the ledger holds for ONE Project, read in a single hop.
    ///
    /// A value rather than two calls, so the surface above cannot publish an `items` from one
    /// moment beside a closed listing from another — and so a third thing landing here costs the
    /// app layer no plumbing at all (ADR-0022 keeps that target to the scene).
    ///
    /// Not to be confused with `TicketReading`, the protocol a read is made THROUGH. This is what
    /// the reads left behind.
    public struct Reading: Equatable, Sendable {
        /// The listing, the tickets followed by number, and the closed pages — `items(of:)`.
        public let items: [Ticket]
        /// What the closed read answered, and `nil` where it never has — `closedListing(of:)`.
        public let closed: ClosedListing?

        public init(items: [Ticket], closed: ClosedListing?) {
            self.items = items
            self.closed = closed
        }

        /// A Project nothing has been read for, and the honest default for a preview and a test.
        public static let nothing = Reading(items: [], closed: nil)
    }

    /// One Project's closed listing as far as it has been read: the pages in hand, and what the
    /// next one is asked for.
    public struct ClosedListing: Sendable, Equatable {
        public internal(set) var items: [Ticket] = []
        /// The cursor for the page behind these, and `nil` where the provider served the last one
        /// — which is also what the `Load more` row reads to decide whether it draws.
        public internal(set) var next: String?

        public var hasMore: Bool {
            next != nil
        }
    }

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

    /// The FIRST page of the closed listing, which is what opening the `Closed` view reads. It
    /// replaces whatever was held, on the poll's own rule: a listing is replaced whole or left
    /// alone, and a reader who opens the view has asked for the set as it is now.
    func openClosed(_ page: ClosedTicketPage, for projectID: String) {
        closed[projectID] = ClosedListing(items: page.items, next: page.next)
    }

    /// The NEXT page, which is what `Load more` reads. It appends, and drops a number already held
    /// — two presses racing on one cursor is a double-read, not a reason to draw a ticket twice.
    ///
    /// It does nothing where no page has been opened yet: a cursor with no first page behind it is
    /// not a listing, and inventing one would make the view's count an answer before it is.
    func extendClosed(_ page: ClosedTicketPage, for projectID: String) {
        guard var listing = closed[projectID] else { return }
        let held = Set(listing.items.map(\.number))
        listing.items += page.items.filter { !held.contains($0.number) }
        listing.next = page.next
        closed[projectID] = listing
    }

    /// The closed listing as far as it has been read, and `nil` where the `Closed` view has never
    /// been opened on this Project. The absence is the reading: see the property's own note.
    public func closedListing(of projectID: String?) -> ClosedListing? {
        projectID.flatMap { closed[$0] }
    }

    /// Both of the above at once — what a surface publishes after every read that landed.
    public func reading(of projectID: String?) -> Reading {
        Reading(items: items(of: projectID), closed: closedListing(of: projectID))
    }

    /// The listing, and an empty one for a Project nothing has read yet — which reads the same as
    /// a repository with no issues, because from a surface's side they are the same: no Tickets
    /// to show, and the health chip is what says whether that is an answer or a silence.
    ///
    /// No Project at all reads empty on the same terms, and never the last one's listing: a window
    /// pointed away from a Project must not go on drawing its backlog.
    ///
    /// The closed listing comes after it, in the order the provider served it, and the tickets
    /// followed by number after that in their own numeric order. **The freshest read wins where
    /// two hold a number**: the listing was read this tick, a closed page when the view was last
    /// opened, and a follow may be an hour old.
    ///
    /// The closed ones are in here rather than beside it because a parent's roll-up counts children
    /// the backlog does not draw — an open parent's `n/m` is only right once the closed children
    /// are in hand (#895's residue, #1075).
    public func items(of projectID: String?) -> [Ticket] {
        guard let projectID else { return [] }
        var held: Set<Int> = []
        return [
            listings[projectID] ?? [],
            closed[projectID]?.items ?? [],
            (followed[projectID] ?? [:]).values.sorted { $0.number < $1.number },
        ]
        .flatMap(\.self)
        .filter { held.insert($0.number).inserted }
    }
}
