// How the reader resolves a background agent's REPORT — the record the CLI files as a user record
// because that is where it puts one.
//
// Two readings, because a report asks two questions. What it IS, which the envelope answers on its
// own; and what it can be JOINED to, which needs a `tool-use-id` naming a call this file opened
// (#945). A file of its own beside `+Outcome.swift`, because the two together would put the
// reader's body over the ceiling `.swiftlint.yml` holds it to.

/// What a report with no call to join it to is named by. Argo's own word: the envelope carries no
/// tool name, and this row is addressed by its summary wherever it has one.
private let unjoinedAgent = "background agent"

/// What a report does to the Turn, ahead of whatever it says about the call (#1299).
///
/// The CLI files a report to put the agent back to work on it, and a fan-out that ended its Turn to
/// wait has no other record that says the run is going again — so this is the boundary, whether or
/// not the report can be joined to a call. It leads the events either way: the Turn is open before
/// anything inside it is folded.
private func woken(at message: MessageRecord) -> [TranscriptEvent] {
    [.turnResumed(atMs: message.timestampMs)]
}

extension TranscriptReader {
    /// A delegating call's outcome, arriving late — a SECOND outcome for a call the launch receipt
    /// only OPENED, and a resumed agent files a third. This is what resolves a backgrounded
    /// delegation: the receipt leaves it `inProgress` (#908) and the report states how it ended.
    /// Every surface reads outcomes by id, so the newest one wins without any of them being told a
    /// report can arrive twice.
    func reported(
        _ report: TaskNotification,
        in message: MessageRecord,
    )
        -> [TranscriptEvent] {
        // A report naming no call, or quoting an id opened in another link of the chain, has
        // nothing to be joined ONTO — the same rule `evidence(for:)` follows. It is still the
        // delegate's own work, so it stands alone rather than being dropped.
        //
        // Standing alone, it ends nothing: the delegation whose receipt left it `inProgress`
        // (#908) stays open, which is honest — no id means Argo cannot know this report is that
        // call's ending.
        guard let callID = report.callID, openCalls[callID] != nil else {
            return woken(at: message) + unattached(report, in: message)
        }
        return woken(at: message) + [.toolCallOutcome(ToolCallOutcome(
            id: callID,
            resolution: ToolCallOutcome.Resolution(
                status: report.status,
                // `derived`: the text is read off an external record rather than owned by Argo.
                result: report.text.map { .output(OutputEvidence(tier: .derived, text: $0)) },
                endedAtMs: message.timestampMs,
            ),
            delegated: ToolCallOutcome.Delegated(
                // The notification states the delegate's spend in a shape of its own — a token
                // TOTAL rather than the host's four counters — which no reading here can honestly
                // fill.
                usage: nil,
                // The join key onto the delegate's own transcript, which this outcome replaces the
                // launch result's copy of. Dropped, it would orphan the Subagent.
                subagentID: report.subagentID,
            ),
        ))]
    }

    /// A report Argo cannot join to a call, drawn as a row of its own: work handed over somewhere
    /// this reading cannot see, and what came back from it.
    ///
    /// NOT a `delegate`, which the Agents rail lifts one row per child from (`FeedAgents`): an
    /// unjoined report would stand there as a second agent beside the one it came from. It carries
    /// no `subagentID` either, for the same reason — that key is read only off a delegation, so
    /// setting it here would state a join nothing can follow.
    private func unattached(
        _ report: TaskNotification,
        in message: MessageRecord,
    )
        -> [TranscriptEvent] {
        // The record's own identity, so two reports from one agent are two rows.
        let id = message.uuid ?? report.subagentID ?? unjoinedAgent
        return [
            .toolCall(ToolCall(
                id: id,
                name: unjoinedAgent,
                kind: .other,
                target: nil,
                narration: report.summary,
                atMs: message.timestampMs,
            )),
            .toolCallOutcome(ToolCallOutcome(
                id: id,
                resolution: ToolCallOutcome.Resolution(
                    status: report.status,
                    // `derived`: the text is read off an external record rather than owned by
                    // Argo.
                    result: report.text.map { .output(OutputEvidence(tier: .derived, text: $0)) },
                    endedAtMs: message.timestampMs,
                ),
            )),
        ]
    }
}
