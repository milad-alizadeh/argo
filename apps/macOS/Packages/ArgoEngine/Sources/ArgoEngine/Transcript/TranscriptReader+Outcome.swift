/// How the reader resolves the record that ANSWERS a call: what the call produced, what it cost,
/// and which Subagent it started.
///
/// A file of its own because the reader's body is at its ceiling, which the `type_body_length`
/// ratchet in `.swiftlint.yml` named as its own change to make.
extension TranscriptReader {
    /// The record is passed whole rather than its timestamp and usage separately, because the third
    /// thing the evidence needs — `toolUseResult` — sits beside `message` at the RECORD level: one
    /// object shared by every result part the record carried, which is the host's shape.
    func outcome(of result: ToolResultBlock, in message: MessageRecord) -> ToolCallOutcome {
        let status: ToolCallStatus = result.isError ? .failed : .completed
        return ToolCallOutcome(
            id: result.toolUseId,
            status: status,
            result: evidence(for: result, status: status, reported: message.toolUseResult),
            endedAtMs: message.timestampMs,
            usage: spend(reportedIn: message),
            // Read whatever the record's sidechain flag says, unlike the spend above: an id is not
            // summed, so there is no double-count for a guard to prevent — see `ToolCallOutcome`.
            subagentID: message.toolUseResult?.stringField("agentId"),
        )
    }

    /// What the call itself reported spending.
    ///
    /// The record answering a call is a USER record, and a user record carries no `usage` of its
    /// own — so a delegating call's spend, which is the whole reason this field exists, is written
    /// where the host puts a tool's own result object instead. Read there second rather than
    /// first: `message.usage` is the host's own field, and it wins wherever one is present.
    private func spend(reportedIn message: MessageRecord) -> Usage? {
        // A SIDECHAIN result is the subagent's own call, not a delegation, and the delegating call
        // above it already reports the whole subtree. Reading both would bill a nested delegation
        // twice — the same guard, and the same reason, as `.usage` and the turn end have.
        guard attributes(message) else { return nil }
        return message.usage ?? Usage(reported: message.toolUseResult?["usage"])
    }

    /// What one resolved call produced, kinded — its patch where it mutated, its image where it
    /// showed one, otherwise what it printed.
    ///
    /// One fixed order over three readings, each of which decides for itself whether the call it is
    /// handed is one it answers. Media outranks output because the two compete: an image result
    /// carries a base64 blob that the output reading would happily print to the screen as text.
    private func evidence(
        for result: ToolResultBlock,
        status: ToolCallStatus,
        reported: JSONValue?,
    )
        -> ToolResult? {
        // A result quoting an id this file never opened belongs to a call in another file (a
        // resumed chain), not to a call that can be invented.
        guard let call = openCalls[result.toolUseId] else { return nil }
        // A delegate's printed work is the subagent's, and the Subagents section owns it.
        guard call.kind != .delegate else { return nil }

        let resolved = ResolvedCall(
            kind: call.kind,
            name: call.name,
            status: status,
            target: call.target,
            content: result.content,
            toolUseResult: reported,
        )
        return diffEvidence(of: resolved).map(ToolResult.diff)
            ?? mediaEvidence(of: resolved, readImage: readImage).map(ToolResult.media)
            ?? outputEvidence(of: resolved).map(ToolResult.output)
    }
}
