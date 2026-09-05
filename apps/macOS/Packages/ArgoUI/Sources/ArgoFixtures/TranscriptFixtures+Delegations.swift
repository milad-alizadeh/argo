import ArgoEngine

package extension TranscriptFixtures {
    /// A review fan-out from the handover to the last report — the transcript the ENDING of a
    /// delegation is judged against (#1281).
    ///
    /// Three delegations, because the row has three shapes and a still that shows one shape shows
    /// nothing about the other two: one that came back priced and timed, one that FAILED, and one
    /// backgrounded Agent that reported neither figure at either end (#908) and still has to land
    /// a row.
    ///
    /// The prose between them is the fixture's point as much as the calls are: the reader's
    /// complaint was that the parent's own sentence was the only place the endings were said.
    static let delegationsEnded: [TranscriptEvent] = [
        .prompt(text: "Review the branch.", images: [], atMs: handedOver(600)),
        delegated("standards", to: "Standards review", secondsAgo: 590),
        delegated("spec", to: "Spec review", secondsAgo: 588),
        .message(markdown: "Both review axes are running. Waiting for results."),
        .toolCallOutcome(spent(
            "standards",
            Usage(
                inputTokens: 3600,
                outputTokens: 40000,
                cacheReadTokens: 100_000,
                cacheCreationTokens: 0,
            ),
            subagent: "a-standards",
            reportedMs: 223_591,
        )),
        .toolCallOutcome(ToolCallOutcome(
            id: "spec",
            resolution: ToolCallOutcome.Resolution(
                status: .failed,
                result: .output(OutputEvidence(
                    tier: .direct,
                    text: "The subagent exited before it reported.",
                )),
                endedAtMs: nil,
            ),
            delegated: ToolCallOutcome.Delegated(usage: nil, subagentID: "a-spec"),
        )),
        .message(markdown: "Standards is in. Spec came apart, so I am running it again in the "
            + "background."),
        delegated("sweep", to: "Sweep the stop reasons", secondsAgo: 300),
        // The receipt that answers a backgrounded handover at once and ends nothing (#908) — the
        // row lands on the REPORT below it, and not here.
        .toolCallOutcome(launched("sweep", subagent: "a-sweep")),
        .toolCallOutcome(ToolCallOutcome(
            id: "sweep",
            resolution: ToolCallOutcome.Resolution(
                status: .completed,
                result: nil,
                endedAtMs: nil,
            ),
            delegated: ToolCallOutcome.Delegated(usage: nil, subagentID: "a-sweep"),
        )),
        .message(markdown: "The sweep is back too."),
        .turnEnded(.endTurn),
    ]

    /// One handover, named the way a real one is: the brief is both the target and the agent's own
    /// account of it, which is what the feed draws.
    private static func delegated(
        _ id: String,
        to brief: String,
        secondsAgo: Int,
    )
        -> TranscriptEvent {
        .toolCall(ToolCall(
            id: id,
            name: "Task",
            kind: .delegate,
            target: brief,
            narration: brief,
            atMs: handedOver(secondsAgo),
        ))
    }
}
