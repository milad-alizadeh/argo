import Foundation

/// One read a ROOM raises, as against the repeating one a poll makes.
///
/// Every one of these is a reader's act — a link followed, a view opened, a page asked for — and
/// none of them is on a cadence. That is the line `TicketPoll` is on the other side of.
public enum TicketRead: Equatable, Sendable {
    /// One Ticket by the number a link named — the only way to a closed one before there was a
    /// view for them (#895).
    case ticket(number: Int)
    /// The first page of the closed listing, replacing whatever was held. What OPENING the
    /// `Closed` view reads (#1075).
    case closedListing
    /// The page behind the one in hand, appended. What `Load more` reads.
    case moreClosedTickets
}

/// Every read a room raises, performed through the Project's own Binding — one seam for all of
/// them.
///
/// One type rather than a call site per read, because the app target is capped at the `@main`
/// scene (ADR-0022) and a fourth read must not cost it a fourth piece of plumbing. What is here
/// is routing and nothing else: each case is its own reader, and each of those owns what it keeps
/// and what it records.
public struct TicketReads: Sendable {
    private let bindings: ProjectBindings
    private let ledgers: TicketPoll.Ledgers

    public init(bindings: ProjectBindings, ledgers: TicketPoll.Ledgers) {
        self.bindings = bindings
        self.ledgers = ledgers
    }

    /// It answers nothing: what lands in the ledger is the answer, and the surface publishes that
    /// (`TicketLedger.reading(of:)`).
    public func perform(_ read: TicketRead, forProject projectID: String?) async {
        switch read {
        case let .ticket(number):
            await follower.follow(number, forProject: projectID)
        case .closedListing:
            await closed.open(forProject: projectID)
        case .moreClosedTickets:
            await closed.extend(forProject: projectID)
        }
    }

    private var follower: TicketFollower {
        TicketFollower(bindings: bindings, items: ledgers.items, health: ledgers.health)
    }

    private var closed: ClosedTicketReader {
        ClosedTicketReader(bindings: bindings, ledgers: ledgers)
    }
}
