import ArgoEngine
import Foundation

/// The room's reading assembled from what the app actually holds (#820) — the poll's listing, the
/// roster, and how the Binding behind them is reading.
///
/// In the package rather than on the coordinator, for the reason ADR-0022 gives: it is a derivation
/// over values, and a derivation in the app target is one no test can reach.
extension TicketsReading {
    /// Everything the app hands in. The listing is the provider's; the other three are the window's
    /// own, and none of them is a Hub fact.
    struct Sources {
        /// What the ledger holds for this Project — the listing, the tickets followed by number,
        /// and what the closed read answered. The ledger's own value, so the rows and the answer
        /// about them can never arrive here from two different moments (#1075).
        let tickets: TicketLedger.Reading
        let sessions: [CockpitPresentation.Session]
        let health: ConnectionHealthReading
        let project: String?
    }

    /// The live room, opened on `showing`.
    ///
    /// Nothing is invented where a read has not happened: `deliveries` stays empty until a code
    /// host is read (#258), so every backlog dot draws the hollow ring `absent` means rather than a
    /// state nobody established.
    ///
    /// `nowMs` is what the claim ceiling below is measured against, defaulted on `FeedAgents`'s
    /// reasoning: every shipping caller wants the real clock, and a suite that passed one is the
    /// only place a fixed moment is worth having.
    static func live(
        _ sources: Sources, showing: Int?, at nowMs: Int = Date().epochMs,
    )
        -> TicketsReading {
        TicketsReading(
            items: sources.tickets.items,
            claims: TicketClaims(over: claimants(in: sources.sessions, at: nowMs)),
            provider: TicketsProvider(reading: sources.health),
            project: sources.project,
            showing: showing,
            closedListing: sources.tickets.closed.map {
                .init(numbers: Set($0.items.map(\.number)), hasMore: $0.hasMore)
            },
        )
    }

    /// The Sessions a claim can be placed from. Read ONCE and asked three ways — which tickets
    /// they hold and who, how many named none, and how many nobody could read at all — so the
    /// count and its shortfall cannot disagree about which Sessions they were derived over.
    ///
    /// The set is `holdsClaim`'s and not `isLive`'s (#1118). An ended Session's branch still names
    /// the ticket it was cut for, and so does a `stopped` one from last spring — the second is the
    /// one that had `In progress` reading 82 with one row beneath it, because every status but
    /// `ended` is live enough to open and none of them is live enough to be WORKING on something.
    ///
    /// Sessions rather than their link readings alone (#1092): the head names WHICH Session, so the
    /// join needs the identity beside the reading, not the reading on its own.
    private static func claimants(
        in sessions: [CockpitPresentation.Session], at nowMs: Int,
    )
        -> [CockpitPresentation.Session] {
        sessions.filter { $0.holdsClaim(at: nowMs) }
    }
}
