import Foundation

/// One transcript's lines → the events they mean.
///
/// Stateful, and only just: a `tool_result` is read against the call it answers, which was declared
/// in an earlier record, so the reader remembers what it has opened. That is the whole of its
/// memory — no turns, no agents, no session. Feeding it lines in order is the contract.
///
/// An `actor` rather than a `class`: a live reader is fed from a file-watching stream while a
/// caller consumes its output, and under Swift 6 that shared mutable state is a compile error
/// unless something serialises it. An actor is that something.
public actor TranscriptReader {
    /// What a call needs to be remembered by until its result lands: the kind decides which
    /// evidence its result is read as, and the target is the path a disk fallback would re-read.
    private struct OpenCall {
        let kind: ToolCallKind
        let target: String?
    }

    private var openCalls: [String: OpenCall] = [:]
    private var lastCwd: String?
    private var lastModel: String?
    private var lastBranch: String?
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
            return context(of: message) + userEvents(message)
        case let .assistant(message):
            return context(of: message) + assistantEvents(message)
        case let .attachment(message):
            return context(of: message)
        case let .aiTitle(title):
            return [.title(title)]
        case let .lastPrompt(leafUuid):
            return [.headLeaf(uuid: leafUuid)]
        case .unknown:
            return []
        }
    }

    /// Every line of a whole file, in order. The batch face of the same reader the tail uses, so a
    /// fixture and a live file are read by one code path.
    public func read(lines: [String]) -> [TranscriptEvent] {
        lines.flatMap { read(line: $0) }
    }

    /// The session facts a record carries beside its content, emitted only when they CHANGE.
    ///
    /// Every record repeats them, and a stream that re-announced the cwd two hundred times would
    /// bury the events anyone is watching for. The cwd keeps its first reading and the branch its
    /// latest, because a run can switch branch mid-session but never switches its root.
    private func context(of message: MessageRecord) -> [TranscriptEvent] {
        var events: [TranscriptEvent] = []
        if let cwd = message.cwd, lastCwd == nil {
            lastCwd = cwd
            events.append(.cwd(cwd))
        }
        if let branch = message.gitBranch, branch != lastBranch {
            lastBranch = branch
            events.append(.branch(branch))
        }
        if let model = message.model, model != lastModel {
            lastModel = model
            events.append(.model(model))
        }
        return events
    }

    private func userEvents(_ message: MessageRecord) -> [TranscriptEvent] {
        // A compact summary is the condensed history itself. Read as a prompt it would open a turn
        // titled with the summary of everything before it.
        if message.isCompactSummary {
            return [.compaction(atMs: message.timestampMs)]
        }

        let results = message.content.compactMap { block -> TranscriptEvent? in
            guard case let .toolResult(result) = block else { return nil }
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
    /// something, which is exactly what a Tool Call is, and filing it as a message would put the
    /// CLI's words in the agent's mouth.
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
        message.content.flatMap { block -> [TranscriptEvent] in
            switch block {
            case let .text(text):
                return said(text).map { [.message(markdown: $0)] } ?? []
            case let .thinking(text):
                return said(text).map { [.thought(markdown: $0)] } ?? []
            case let .toolUse(use):
                return callEvents(use, atMs: message.timestampMs)
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

    private func callEvents(_ use: ToolUseBlock, atMs: Int?) -> [TranscriptEvent] {
        let kind = toolCallKind(use.name)
        openCalls[use.id] = OpenCall(kind: kind, target: toolCallTarget(use.input))
        let call = ToolCall(
            id: use.id,
            name: use.name,
            kind: kind,
            target: toolCallTarget(use.input),
            atMs: atMs,
        )
        // The plan tool's input IS the plan, so the call and the list it wrote are one record's
        // worth of news. Both are emitted: the call is what happened, the plan is what it said.
        guard use.name == planTool, let written = plan(from: use.input) else {
            return [.toolCall(call)]
        }
        return [.toolCall(call), .plan(written)]
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
            usage: message.usage,
        )
    }

    /// What one resolved call produced, kinded — its patch where it mutated, its image where it
    /// showed one, otherwise what it printed.
    ///
    /// The patch is read only for the calls whose kind SAYS they mutate: a record can carry one
    /// beside any call, and reading it onto a `read` would put a diff under a row that changed
    /// nothing. An `edit` conversely never reads media, because a `Write` to an `.svg` is a change
    /// to a file and answering it with a picture would replace the diff of what changed with a
    /// render of what it became.
    ///
    /// Media outranks output for everything else, because the two readings compete: an image result
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
        if call.kind == .delegate {
            return nil
        }

        if call.kind == .edit {
            if let diff = diffEvidence(from: reported) {
                return .diff(diff)
            }
        } else if let media = mediaEvidence(
            from: MediaRead(
                toolUseResult: reported,
                content: result.content,
                path: diskFallbackPath(call, status: status, content: result.content),
            ),
            readImage: readImage,
        ) {
            return .media(media)
        }
        // Output is kept only where a row reads it: a command shows what it printed, and a failure
        // of any kind shows what went wrong. A successful read's output is the whole file, and
        // holding every file a session read would be the engine's largest cost for a payload
        // nothing renders.
        guard call.kind == .execute || status == .failed else { return nil }
        return outputEvidence(from: result.content).map(ToolResult.output)
    }

    /// The path worth RE-READING, which is much narrower than the path the call named.
    ///
    /// Three gates, each closing a case where a disk read answers the wrong question. Only a read,
    /// because a search's pattern, a command line and a subagent's description all land in the same
    /// field and none names a file. Only a call that COMPLETED, because a failed read of a `.png`
    /// has an error message worth showing and a picture of the file as it stands now does not
    /// explain the failure. And only where the result carried no text of its own: Claude Code hands
    /// an `.svg` back as SOURCE, and rendering that read as a picture would pull a real text row
    /// out of the quiet fold.
    private func diskFallbackPath(
        _ call: OpenCall,
        status: ToolCallStatus,
        content: JSONValue,
    )
        -> String? {
        guard call.kind == .read, status == .completed else { return nil }
        return outputEvidence(from: content) == nil ? call.target : nil
    }
}
