import Foundation

/// The host's word for "I stopped to call a tool" — a pause inside a Turn, not its end.
private let continuingStopReason = "tool_use"

/// One transcript's lines → the events they mean.
///
/// Stateful, and only just: a `tool_result` is read against the call it answers, which was declared
/// in an earlier record. Feeding it lines in order is the contract.
///
/// An `actor` because a live reader is fed from a file-watching stream while a caller consumes its
/// output, which under Swift 6 is a compile error unless something serialises it.
public actor TranscriptReader {
    /// What a call needs to be remembered by until its result lands: the kind decides which
    /// evidence its result is read as, and the target is the path a disk fallback would re-read.
    private struct OpenCall {
        let kind: ToolCallKind
        /// The host's own name, kept because one reading is gated on it rather than on the kind:
        /// a question's answer is worth keeping and this vocabulary has no kind for a question.
        let name: String
        let target: String?
    }

    private var openCalls: [String: OpenCall] = [:]
    /// The reader's second memory, and for the same reason as its first: a host that writes its
    /// plan one entry at a time leaves the list itself nowhere in the record.
    private var planLedger = PlanLedger()
    private var context = TranscriptContextCursor()
    private let readImage: ImageReader

    public init(readImage: @escaping ImageReader = noImageReader) {
        self.readImage = readImage
    }

    /// One line → the events it carried, in the order the record wrote them.
    ///
    /// Zero events is an ordinary answer, not a failure: a `system` record means nothing to this
    /// reader, and a record that is only plumbing has nothing to say.
    public func read(line: String) -> [TranscriptEvent] {
        // A blank line is the file's own punctuation — the trailing newline every writer leaves —
        // and reporting it as unreadable would put noise in front of every real one.
        guard !line.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return [] }
        guard let record = TranscriptRecord.parse(line: line) else {
            return [.unreadableLine(raw: line)]
        }
        switch record {
        case let .user(message):
            return identity(of: message) + context.events(for: message) + userEvents(message)
        case let .assistant(message):
            return identity(of: message) + context.events(for: message) + assistantEvents(message)
        case let .attachment(message):
            return identity(of: message) + context.events(for: message)
        case let .aiTitle(title):
            return [.title(title)]
        case let .lastPrompt(leafUuid):
            return [.headLeaf(uuid: leafUuid)]
        case .queueOperation:
            return [.queued]
        case .unknown:
            return []
        }
    }

    private func identity(of message: MessageRecord) -> [TranscriptEvent] {
        message.uuid.map { [.recordIdentity(uuid: $0)] } ?? []
    }

    /// Every line of a whole file, in order. The batch face of the same reader the tail uses, so a
    /// fixture and a live file are read by one code path.
    public func read(lines: [String]) -> [TranscriptEvent] {
        lines.flatMap { read(line: $0) }
    }

    private func userEvents(_ message: MessageRecord) -> [TranscriptEvent] {
        // A compact summary is the condensed history itself. Read as a prompt it would open a turn
        // titled with the summary of everything before it.
        if message.isCompactSummary {
            return [.compaction(atMs: message.timestampMs)]
        }

        let results = message.content.compactMap { block -> TranscriptEvent? in
            guard case let .toolResult(result) = block else { return nil }
            // A created task's id is reported HERE and nowhere else, so the ledger is fed as the
            // result goes past. No event of its own: an entry learning the name updates will
            // address it by is not a change to the list anybody is reading.
            planLedger.identify(call: result.toolUseId, from: message.toolUseResult)
            return .toolCallOutcome(outcome(of: result, in: message))
        }
        // A record carrying results is the tool answering, never the user asking.
        if !results.isEmpty {
            return results
        }

        return message.isMeta ? [] : promptEvents(message)
    }

    /// A prompt, or the local command whose output this record IS.
    ///
    /// The output comes back as a Tool Call rather than as prose: a command ran and printed
    /// something, which is exactly what a Tool Call is.
    private func promptEvents(_ message: MessageRecord) -> [TranscriptEvent] {
        if let printed = localCommandOutput(message.content) {
            let id = message.uuid ?? "local-command"
            return [
                .toolCall(ToolCall(
                    id: id,
                    name: "local command",
                    kind: .execute,
                    target: nil,
                    atMs: message.timestampMs,
                )),
                .toolCallOutcome(ToolCallOutcome(
                    id: id,
                    status: .completed,
                    // `derived`: the text is read off an external record rather than owned by Argo.
                    result: .output(OutputEvidence(tier: .derived, text: printed)),
                    // A local command prints and is over. There is no second record to learn its
                    // end from, and the moment it printed is the moment it finished.
                    endedAtMs: message.timestampMs,
                    usage: nil,
                )),
            ]
        }
        guard let prompt = userPrompt(message.content) else { return [] }
        return [.prompt(text: prompt, atMs: message.timestampMs)]
    }

    private func assistantEvents(_ message: MessageRecord) -> [TranscriptEvent] {
        contentEvents(message) + spent(in: message) + turnEnd(of: message)
    }

    /// What this record reported spending, where it reported anything.
    ///
    /// A sidechain record is skipped for the same reason its turn boundary is: the spend is the
    /// child's, and the delegating call's result already carries it whole. Counted here as well,
    /// every delegated token would be in the Session's total twice.
    private func spent(in message: MessageRecord) -> [TranscriptEvent] {
        guard !message.isSidechain, let usage = message.usage else { return [] }
        return [.usage(usage)]
    }

    /// The Turn boundary a record reports, or nothing.
    ///
    /// `tool_use` is the reason a working agent stops to call something, and every call carries it
    /// — so it is the one word that must NOT be read as an end. A subagent's record is skipped for
    /// the same reason one level up: its turn is the child's, and closing the root's on it would
    /// report a Session as quiet while its delegate is still working.
    private func turnEnd(of message: MessageRecord) -> [TranscriptEvent] {
        guard !message.isSidechain else { return [] }
        guard let reported = message.stopReason, reported != continuingStopReason else { return [] }
        return [.turnEnded(StopReason(reported: reported))]
    }

    private func contentEvents(_ message: MessageRecord) -> [TranscriptEvent] {
        message.content.flatMap { block -> [TranscriptEvent] in
            switch block {
            case let .text(text):
                return said(text).map { [.message(markdown: $0)] } ?? []
            case let .thinking(text):
                return said(text).map { [.thought(markdown: $0)] } ?? []
            case let .toolUse(use):
                return callEvents(use, in: message)
            case .toolResult, .image, .unreadable:
                return []
            }
        }
    }

    /// Prose with something in it, held verbatim, or nothing.
    ///
    /// Blank is nothing said rather than an empty thing said — and it is not a rare edge: a real
    /// Claude Code record carries every redacted thought as `"thinking": ""` beside an encrypted
    /// signature, so a reader that emits those fills a live feed with silent rows.
    private func said(_ text: String) -> String? {
        text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : text
    }

    private func callEvents(_ use: ToolUseBlock, in message: MessageRecord) -> [TranscriptEvent] {
        let kind = toolCallKind(use.name)
        openCalls[use.id] = OpenCall(kind: kind, name: use.name, target: toolCallTarget(use.input))
        let call = ToolCall(
            id: use.id,
            name: use.name,
            kind: kind,
            target: toolCallTarget(use.input),
            narration: toolCallNarration(use.input),
            atMs: message.timestampMs,
            // Gated on the tool's own name: `AskUserQuestion` is how a record distinguishes a
            // question that BLOCKS from one the agent merely typed into a message.
            ask: use.name == ToolCall.askUserQuestion ? ask(from: use.input) : nil,
        )
        // Both are emitted: the call is what happened, the plan is what it said.
        guard let written = planWritten(by: use, in: message) else { return [.toolCall(call)] }
        return [.toolCall(call), .plan(written)]
    }

    /// The whole list after this call, whichever way the host writes one — `TodoWrite` hands it
    /// over entire, and the `Task` tools write an entry at a time into the ledger. Either way what
    /// leaves here is one whole list, so nothing downstream knows which host it was reading.
    ///
    /// A SIDECHAIN record writes nothing, the same guard `.usage` and the turn end already carry:
    /// the Plan is Session-scoped (ADR-0020), and a delegate's own to-do list folded into its
    /// parent's would put a subagent's steps on the Session's pill — permanently, since an
    /// incremental list is never replaced whole by the next write.
    private func planWritten(by use: ToolUseBlock, in message: MessageRecord) -> Plan? {
        guard !message.isSidechain else { return nil }
        guard use.name != planTool else { return plan(from: use.input) }
        return planLedger.written(by: use)
    }

    /// The record is passed whole rather than its timestamp and usage separately, because the third
    /// thing the evidence needs — `toolUseResult` — sits beside `message` at the RECORD level: one
    /// object shared by every result part the record carried, which is the host's shape.
    private func outcome(of result: ToolResultBlock, in message: MessageRecord) -> ToolCallOutcome {
        let status: ToolCallStatus = result.isError ? .failed : .completed
        return ToolCallOutcome(
            id: result.toolUseId,
            status: status,
            result: evidence(for: result, status: status, reported: message.toolUseResult),
            endedAtMs: message.timestampMs,
            usage: spend(reportedIn: message),
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
        guard !message.isSidechain else { return nil }
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
