import ArgoEngine

/// The room's reading assembled from what the app actually holds (#820) — the poll's listing, the
/// roster, and how the Binding behind them is reading.
///
/// In the package rather than on the coordinator, for the reason ADR-0022 gives: it is a derivation
/// over values, and a derivation in the app target is one no test can reach.
extension WorkReading {
    /// Everything the app hands in. The listing is the provider's; the other three are the window's
    /// own, and none of them is a Hub fact.
    struct Sources {
        let items: [WorkItem]
        let sessions: [CockpitPresentation.Session]
        let health: ConnectionHealthReading
        let project: String?
    }

    /// The live room, opened on `showing`.
    ///
    /// Nothing is invented where a read has not happened: `deliveries` stays empty until a code
    /// host is read (#258), so every backlog dot draws the hollow ring `absent` means rather than a
    /// state nobody established.
    static func live(_ sources: Sources, showing: Int?) -> WorkReading {
        WorkReading(
            items: sources.items,
            claimed: claims(in: sources.sessions),
            provider: WorkProvider(reading: sources.health),
            project: sources.project,
            showing: showing,
        )
    }

    /// Which tickets a Session is on. DIRECT — no provider carries a claim, and Argo's own
    /// roster is the only thing that knows one.
    ///
    /// LIVE Sessions only. An ended Session's branch still names the ticket it was cut for, and
    /// counting that as a claim would leave `In progress` filling up for the life of the machine.
    private static func claims(in sessions: [CockpitPresentation.Session]) -> Set<Int> {
        Set(sessions.filter(\.isLive).compactMap { $0.issue?.number })
    }
}
