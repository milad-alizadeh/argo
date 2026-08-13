import ArgoEngine

/// The readings behind the rail's chips — what a selected Agent scopes the feed ONTO.
///
/// Fixtures, because the engine does not read these files yet (#711). Without them the scoped feed
/// is a state nobody can look at: every chip in a real Session is a quiet row until that lands, and
/// a state with no render has not been looked at.
enum AgentsRailFixture {
    /// The Subagent the preview transcript's one answered delegation names.
    static let verifierID = "a-verify"

    /// The reading behind that one chip. The rest of the preview's delegations are unanswered, so
    /// they name no Subagent and stay unselectable — which is the honest shape of a live fan-out.
    static let readings = FeedAgentReadings(events: [verifierID: verifier])

    /// Every Agent in the wide fan-out read, so the many-Agent render shows a rail of controls
    /// rather than a rail of quiet rows.
    static let fanOutReadings = FeedAgentReadings(
        events: Dictionary(
            uniqueKeysWithValues: AgentsFanOutFixture.agents.compactMap { agent in
                agent.subagentID.map { ($0, verifier) }
            },
        ),
    )

    /// A Session that handed work to exactly ONE Agent, and is waiting on it.
    ///
    /// Its own reading rather than the preview transcript cut down. The rail's rhythm at one chip
    /// is the state a fan-out fixture cannot show, and a list of one is where the heading over it
    /// is most at risk of reading as ceremony.
    static let soleAgentRows = FeedProjection.rows(from: soleAgent, working: true)

    private static let soleAgent: [TranscriptEvent] = [
        .prompt(text: "Check the fold breaks at every mark.", atMs: 1_733_000_000_000),
        .message(markdown: "Handing that to one agent — it is a read of one file and a claim."),
        // Unanswered on purpose: a delegation the record has not answered IS a child still working,
        // which is what puts the rail on screen at all. It names no Subagent yet either, so the one
        // chip is a quiet row rather than a control — the honest state of a fan-out in flight.
        .toolCall(ToolCall(
            id: "sole-verify", name: "Task", kind: .delegate,
            target: "Verify: the fold breaks at every mark",
            narration: "Verify: the fold breaks at every mark",
            // Relative to now, because the chip counts up from it — see `Session.handedOver(_:)`.
            atMs: CockpitPresentation.Session.handedOver(133),
        )),
    ]

    /// One Subagent's own turn: what it was handed, what it did, and how it ended. Short on purpose
    /// — the claim a render of this settles is that the feed re-scopes, not how long a child runs.
    private static let verifier: [TranscriptEvent] = [
        .prompt(text: "Verify: the fold breaks at every mark", atMs: 1_733_000_200_000),
        .thought(
            markdown: "The break rule is the survey's, so read `FeedSurveyFold` before the marks.",
        ),
        .toolCall(ToolCall(
            id: "verify-read", name: "Read", kind: .read,
            target: "Sources/ArgoUI/Shell/Deck/Feed/Call/FeedSurveyFold.swift", atMs: nil,
        )),
        .toolCallOutcome(ToolCallOutcome(
            id: "verify-read",
            status: .completed,
            result: .output(OutputEvidence(tier: .derived, text: "Read 84 lines.")),
            endedAtMs: nil,
            usage: nil,
        )),
        .message(
            markdown: "It breaks at every mark. A punctuation row ends the run rather than being "
                + "counted into it, which is what keeps a compaction out of a survey line.",
        ),
        .usage(Usage(
            inputTokens: 3600,
            outputTokens: 40000,
            cacheReadTokens: 100_000,
            cacheCreationTokens: 0,
        )),
        .turnEnded(.endTurn),
    ]
}
