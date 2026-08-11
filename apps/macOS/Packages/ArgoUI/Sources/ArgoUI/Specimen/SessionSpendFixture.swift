import ArgoEngine

/// The Sessions the spend line is rendered from — one with every fact reported, and one whose
/// subagent spend nobody reported, which is every Session on this machine today. The two differ in
/// exactly one fact (story 53).
enum SessionSpendFixture {
    /// A day's work as a transcript actually records one: bursts of calls half a minute apart with
    /// the reader away in between. A fixture of evenly spaced ticks would make the five-minute
    /// cutoff decide nothing at all.
    private enum Rhythm {
        static let bursts = 6
        static let callsPerBurst = 25
        static let betweenCallsMs = 30000
        /// Comfortably past the cutoff: this is the reader at lunch, not an agent thinking.
        static let betweenBurstsMs = 55 * 60 * 1000
    }

    /// Each keyed by the catalog case that renders it, so the PNG a case is named for and the line
    /// it actually draws cannot drift apart.
    static let spends: [(specimen: Specimen, header: SessionHeaderProjection.Header)] = [
        (.sessionSpend, header(subagentTokens: 4_130_000)),
        (.sessionSpendUnreported, header(subagentTokens: nil)),
    ]

    /// Just the headers, for the previews that judge the lines as a group.
    static let headers = spends.map(\.header)

    static func header(subagentTokens: Int?) -> SessionHeaderProjection.Header {
        SessionHeaderProjection.header(from: CockpitPresentation.Session(
            id: "spend-\(subagentTokens.map(String.init) ?? "unreported")",
            title: "Ship the native Liquid Glass application shell",
            model: "claude-opus-5",
            workspaceLocation: "/Users/milad/Developer/argo",
            access: .managed,
            status: .idle,
            cli: .claude,
            workspace: .init(kind: .worktree, branch: "argo/#512-header-spend-duration", dirty: 3),
            lastSeenAtMs: moments.last,
            startedAtMs: moments.first,
            // Readings off a real long-running Session, not round numbers: the line has to fit
            // `1.83M tokens spent · 28.1M cached`, a width `2M`/`30M` would not test.
            spentTokens: 1_830_000,
            cachedTokens: 28_100_000,
            subagentTokens: subagentTokens,
            contextTokens: 216_764,
            events: events,
        ))
    }

    /// Every moment the fixture Session did something, in order.
    private static let moments: [Int] = (0 ..< Rhythm.bursts).flatMap { burst in
        let burstStart = burst * (Rhythm.callsPerBurst - 1) * Rhythm.betweenCallsMs
            + burst * Rhythm.betweenBurstsMs
        return (0 ..< Rhythm.callsPerBurst).map { burstStart + $0 * Rhythm.betweenCallsMs }
    }

    private static let events: [TranscriptEvent] = moments.enumerated().map { index, atMs in
        .toolCall(ToolCall(
            id: "call-\(index)",
            name: "Read",
            kind: .read,
            target: "CONTEXT.md",
            atMs: atMs,
        ))
    }
}
