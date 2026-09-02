import ArgoEngine

/// The room's reading assembled from what the app actually holds (#820) — the poll's listing, the
/// roster, and how the Binding behind them is reading.
///
/// In the package rather than on the coordinator, for the reason ADR-0022 gives: it is a derivation
/// over values, and a derivation in the app target is one no test can reach.
extension TicketsReading {
    /// Everything the app hands in. The listing is the provider's; the other three are the window's
    /// own, and none of them is a Hub fact.
    struct Sources {
        let items: [Ticket]
        let sessions: [CockpitPresentation.Session]
        let health: ConnectionHealthReading
        let project: String?
        /// The closed listing as far as the reader has asked for it, and `nil` where the `Closed`
        /// view has never been opened on this Project (#1075). The tickets in it are already in
        /// `items` — this is the ANSWER, not the rows.
        var closed: TicketLedger.ClosedListing?
    }

    /// The live room, opened on `showing`.
    ///
    /// Nothing is invented where a read has not happened: `deliveries` stays empty until a code
    /// host is read (#258), so every backlog dot draws the hollow ring `absent` means rather than a
    /// state nobody established.
    static func live(_ sources: Sources, showing: Int?) -> TicketsReading {
        let claims = TicketClaims(over: links(in: sources.sessions))
        return TicketsReading(
            items: sources.items,
            claimed: claims.numbers,
            claimsUnplaced: claims.unplaced,
            claimsUnread: claims.unread,
            provider: TicketsProvider(reading: sources.health),
            project: sources.project,
            showing: showing,
            closedListing: sources.closed.map {
                .init(numbers: Set($0.items.map(\.number)), hasMore: $0.hasMore)
            },
        )
    }

    /// The link readings a claim can be placed from. Read ONCE and asked three ways — which
    /// tickets they hold, how many named none, and how many nobody could read at all — so the
    /// count and its shortfall cannot disagree about which Sessions they were derived over.
    ///
    /// LIVE Sessions only. An ended Session's branch still names the ticket it was cut for, and
    /// counting that as a claim would leave `In progress` filling up for the life of the machine.
    private static func links(
        in sessions: [CockpitPresentation.Session],
    )
        -> [CockpitPresentation.Session.TicketLinkReading] {
        sessions.filter(\.isLive).map(\.ticket)
    }
}
