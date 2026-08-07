/// The facts every message-bearing record carries, whichever of the three types it is.
public struct MessageRecord: Sendable, Equatable {
    public let uuid: String?
    public let parentUuid: String?
    public let cwd: String?
    public let gitBranch: String?
    public let timestampMs: Int?
    /// The host talking to ITSELF. Claude Code's own flag, taken at face value rather than inferred
    /// from the text: it is the one signal that separates plumbing from a prompt, and sniffing for
    /// a sentence instead would mean pattern-matching something the user could have typed. A host
    /// that sets no such flag simply has no meta records, which is the honest degradation.
    public let isMeta: Bool
    /// This record IS the condensed history, not a prompt in front of it.
    public let isCompactSummary: Bool
    /// Only an assistant record names one.
    public let model: String?
    public let stopReason: String?
    public let usage: Usage?
    public let content: [ContentBlock]
    /// The host's own result object, unread. Where a mutation's patch and an image's bytes live.
    public let toolUseResult: JSONValue?
}

/// One line of a transcript, typed.
///
/// The `unknown` case is the ticket's honesty requirement expressed in the type system rather than
/// in a convention: a line this reader does not recognise is a VALUE carrying its own raw bytes,
/// not a thrown error and not a silent skip. Nothing downstream can forget to handle it, because
/// `switch` over an enum is checked for exhaustiveness by the compiler.
public enum TranscriptRecord: Sendable, Equatable {
    case user(MessageRecord)
    case assistant(MessageRecord)
    case attachment(MessageRecord)
    case aiTitle(String)
    case lastPrompt(leafUuid: String)
    /// A record whose `type` this reader does not know — the hosts write several (`system`,
    /// `mode`, `bridge-session`) and will write more. Carries the raw line so observing it loses
    /// nothing.
    case unknown(raw: String)
}

public extension TranscriptRecord {
    /// One raw line → one record, or `nil` for a line that is not a JSON object at all.
    ///
    /// Never throws. The two failures are told apart on purpose: a line that is not a record has
    /// no `type` to be unknown, and reads as `nil` so the caller can report it as unreadable; a
    /// line that IS a record with a `type` nothing recognises reads as `.unknown` and keeps its
    /// bytes.
    static func parse(line: String) -> TranscriptRecord? {
        guard let record = JSONValue.record(fromLine: line) else { return nil }
        switch record.stringField("type") {
        case "user":
            return .user(MessageRecord(record: record))
        case "assistant":
            return .assistant(MessageRecord(record: record))
        case "attachment":
            return .attachment(MessageRecord(record: record))
        case "ai-title":
            return record.stringField("aiTitle")
                .map(TranscriptRecord.aiTitle) ?? .unknown(raw: line)
        case "last-prompt":
            return record.stringField("leafUuid")
                .map { TranscriptRecord.lastPrompt(leafUuid: $0) } ?? .unknown(raw: line)
        default:
            return .unknown(raw: line)
        }
    }
}

extension MessageRecord {
    init(record: JSONValue) {
        let message = record["message"]
        self.uuid = record.stringField("uuid")
        self.parentUuid = record.stringField("parentUuid")
        self.cwd = record.stringField("cwd")
        self.gitBranch = record.stringField("gitBranch")
        self.timestampMs = ArgoEngine.timestampMs(record)
        self.isMeta = record["isMeta"]?.bool == true
        self.isCompactSummary = record["isCompactSummary"]?.bool == true
        self.model = message?.stringField("model")
        self.stopReason = message?.stringField("stop_reason")
        self.usage = Usage(reported: message?["usage"])
        self.content = ContentBlock.blocks(from: message?["content"])
        self.toolUseResult = record["toolUseResult"]
    }
}

extension Usage {
    /// The host's own `usage` object. Absent where the record carried none — a zeroed Usage would
    /// claim the turn spent nothing, which is a different statement from not knowing what it spent.
    init?(reported: JSONValue?) {
        guard let reported, reported.object != nil else { return nil }
        self.init(
            inputTokens: reported["input_tokens"]?.int ?? 0,
            outputTokens: reported["output_tokens"]?.int ?? 0,
            cacheReadTokens: reported["cache_read_input_tokens"]?.int ?? 0,
            cacheCreationTokens: reported["cache_creation_input_tokens"]?.int ?? 0,
        )
    }
}
