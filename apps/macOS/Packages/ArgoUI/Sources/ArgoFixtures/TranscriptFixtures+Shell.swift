import ArgoEngine

package extension TranscriptFixtures {
    /// A `!` command the reader typed at the CLI's own prompt, still running (#1595).
    ///
    /// The whole exchange is two records, and this is the file between them — the state the ticket
    /// is about, where the command has been asked for and nothing has printed yet.
    static let askedShellCommand: [TranscriptEvent] = [
        .prompt(
            text: "! gh auth refresh -h github.com -s admin:repo_hook",
            images: [],
            atMs: nil,
        ),
    ]

    /// The same exchange once the command exited — two minutes later, for this one.
    static let printedShellCommand: [TranscriptEvent] = askedShellCommand + [
        .toolCall(ToolCall(
            id: "shell-asked", name: "shell command", kind: .execute, target: nil, atMs: nil,
        )),
        .toolCallOutcome(ToolCallOutcome(
            id: "shell-asked",
            resolution: ToolCallOutcome.Resolution(
                status: .completed,
                result: .output(OutputEvidence(
                    tier: .derived,
                    text: "Command did not complete within its 120s timeout and was moved to the "
                        + "background (ID: bhvuxhv65).",
                )),
                endedAtMs: nil,
            ),
        )),
        .turnEnded(.endTurn),
    ]
}
