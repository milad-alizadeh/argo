import Foundation

/// What a command the CLI ran ITSELF leaves in the stream once it has printed.
///
/// One shape for both kinds, because both are the same event read off a record the agent had no
/// part in: a local `/command` (#1234) and a `!` shell command (#1595). The output comes back as a
/// Tool Call rather than as prose — a command ran and printed something, which is exactly what a
/// Tool Call is — and the Turn ends there, because no agent ever answers one and nothing else in
/// the file would ever close it.
enum CommandOutput {
    static func events(
        id: String,
        name: String,
        printed: String,
        atMs: Int?,
    )
        -> [TranscriptEvent] {
        [
            .toolCall(ToolCall(id: id, name: name, kind: .execute, target: nil, atMs: atMs)),
            .toolCallOutcome(ToolCallOutcome(
                id: id,
                resolution: ToolCallOutcome.Resolution(
                    status: .completed,
                    // `derived`: the text is read off an external record rather than owned by Argo.
                    result: .output(OutputEvidence(tier: .derived, text: printed)),
                    // The moment it printed is the moment it finished.
                    endedAtMs: atMs,
                ),
            )),
            // `endTurn` and not `cancelled`: nothing was stopped and no wall was hit. The command
            // was asked for, it answered, and that is a Turn that simply finished — which is what
            // the roster reads `idle` off and what releases the follow-ups queued behind it.
            .turnEnded(.endTurn),
        ]
    }
}
