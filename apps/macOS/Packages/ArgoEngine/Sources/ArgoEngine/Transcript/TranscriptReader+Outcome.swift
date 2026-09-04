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
        let status = status(of: result, reported: message.toolUseResult)
        return ToolCallOutcome(
            id: result.toolUseId,
            resolution: ToolCallOutcome.Resolution(
                status: status,
                result: evidence(for: result, status: status, reported: message.toolUseResult),
                endedAtMs: message.timestampMs,
            ),
            delegated: ToolCallOutcome.Delegated(
                usage: spend(reportedIn: message),
                // Read whatever the record's sidechain flag says, unlike the spend above: an id is
                // not summed, so there is no double-count for a guard to prevent — see
                // `ToolCallOutcome`.
                subagentID: message.toolUseResult?.stringField("agentId"),
                reportedDurationMs: message.toolUseResult?["totalDurationMs"]?.int,
            ),
        )
    }

    /// How the answering record leaves the call.
    ///
    /// A backgrounded delegation is answered AT ONCE with a launch receipt, which resolves nothing:
    /// the agent it names is still working, and the report that ends it lands later as a second
    /// outcome for the same id. Reading the receipt as `completed` would retire the call the moment
    /// it started, and with it every "someone is working" reading keyed off a pending call.
    ///
    /// Confined to a DELEGATION the reader opened, the rule `evidence(for:)` follows. `reported`
    /// sits at the record level and is shared by every result the record carried, so a receipt
    /// beside another tool's result would leave that call unresolved — and only a delegation has a
    /// report coming to resolve it.
    private func status(of result: ToolResultBlock, reported: JSONValue?) -> ToolCallStatus {
        guard !result.isError else { return .failed }
        guard openCalls[result.toolUseId]?.kind == .delegate,
              reported?.stringField("status") == asyncLaunchStatus else { return .completed }
        return .inProgress
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
        return message.usage?.usage ?? UsageReading(reported: message.toolUseResult?["usage"])?
            .usage
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
            ?? mediaEvidence(of: resolved, readImage: readImage, in: location)
            .map(ToolResult.media)
            ?? outputEvidence(of: resolved).map(ToolResult.output)
    }
}

/// The status a host writes into the receipt answering a backgrounded delegation. A backgrounded
/// shell command is answered `forked` instead, under a `backgroundTaskId` this shares no field
/// with — which is why #908 could not fix both at once.
private let asyncLaunchStatus = "async_launched"
