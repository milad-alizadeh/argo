import Foundation

/// The host's word for "I stopped to call a tool" — a pause inside a Turn, not its end.
private let continuingStopReason = "tool_use"

/// What an ASSISTANT record says: the prose and thoughts it emitted, the calls it made and the Plan
/// they wrote, what it reported spending, and whether its Turn ended there.
///
/// The seam is the record KIND: `TranscriptReader.swift` keeps the routing that sends a line here,
/// to `+Outcome`, or to `+Report`.
extension TranscriptReader {
    func assistantEvents(_ message: MessageRecord) -> [TranscriptEvent] {
        contentEvents(message) + spent(in: message) + turnEnd(of: message)
    }

    /// What this record reported spending, where it reported anything.
    ///
    /// A sidechain record is skipped for the same reason its turn boundary is: the spend is the
    /// child's, and the delegating call's result already carries it whole. Counted here as well,
    /// every delegated token would be in the Session's total twice.
    private func spent(in message: MessageRecord) -> [TranscriptEvent] {
        guard attributes(message), let usage = message.usage else { return [] }
        return [.usage(usage)]
    }

    /// The Turn boundary a record reports, or nothing.
    ///
    /// `tool_use` is the reason a working agent stops to call something, and every call carries it
    /// — so it is the one word that must NOT be read as an end. A subagent's record is skipped for
    /// the same reason one level up: its turn is the child's, and closing the root's on it would
    /// report a Session as quiet while its delegate is still working.
    private func turnEnd(of message: MessageRecord) -> [TranscriptEvent] {
        guard attributes(message) else { return [] }
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
        guard attributes(message) else { return nil }
        guard use.name != planTool else { return plan(from: use.input) }
        return planLedger.written(by: use)
    }
}
