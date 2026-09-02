/// The facts every message-bearing record carries, whichever of the three types it is.
public struct MessageRecord: Sendable, Equatable {
    public let uuid: String?
    public let parentUuid: String?
    /// The chain's ORIGIN session, in the host's own snake_case field. It stops moving when the
    /// file does: a relocated transcript's records still name the session the run began as, which
    /// is the one key `EnterWorktree` leaves behind (#735).
    public let originSessionID: String?
    public let cwd: String?
    public let gitBranch: String?
    public let timestampMs: Int?
    /// Who wrote this record, where it was not the Session's own two parties — see `Authorship`.
    public let authorship: Authorship
    /// How the process writing this file was started, in the host's own word and unread — what it
    /// means on Argo's own axis is `SessionEntry`'s to say. Every message-bearing record carries
    /// it, and a host that writes none simply has no reading, which degrades to `interactive`.
    public let entrypoint: String?
    /// The standing stance this record was written under, which only a PROMPT carries — a tool
    /// result is a user record with none. Read as a stance for the reason `case permissionMode`
    /// below states (#629).
    public let permissionMode: String?
    /// Only an assistant record names one.
    public let model: String?
    public let stopReason: String?
    public let usage: Usage?
    public let content: [ContentBlock]
    /// The host's own result object, unread. Where a mutation's patch and an image's bytes live.
    public let toolUseResult: JSONValue?

    /// Who wrote this record and on whose behalf — the three flags that each name a writer other
    /// than the Session's own two parties, and each of which disowns the record from the Session's
    /// exchange for a different reason.
    public struct Authorship: Sendable, Equatable {
        /// The host talking to ITSELF. Claude Code's own flag, taken at face value rather than
        /// inferred from the text: it is the one signal that separates plumbing from a prompt. A
        /// host that sets no such flag simply has no meta records, which is the honest degradation.
        public let isMeta: Bool
        /// This record IS the condensed history, not a prompt in front of it.
        public let isCompactSummary: Bool
        /// A delegated subagent's record, written into the parent's own file. Its Turns are the
        /// child's, so the root Session's Turn is neither opened nor closed by one.
        public let isSidechain: Bool
    }
}

/// One line of a transcript, typed.
///
/// A line this reader does not recognise is a VALUE carrying its own raw bytes, not a thrown error
/// and not a silent skip. Nothing downstream can forget to handle it: `switch` over an enum is
/// checked for exhaustiveness by the compiler.
public enum TranscriptRecord: Sendable, Equatable {
    case user(MessageRecord)
    case assistant(MessageRecord)
    case attachment(MessageRecord)
    case aiTitle(String)
    case lastPrompt(leafUuid: String)
    /// The host's own note that a prompt was QUEUED rather than run. Recognised because of what a
    /// file carrying nothing else is: the CLI opens a transcript the moment a prompt is queued, so
    /// a machine that queued several off one Session leaves several files, each holding one copy of
    /// the same prompt and no agent output at all.
    case queueOperation
    /// The host's own note of the Session's standing permission stance. Written at some Turn
    /// boundaries and at exit, and NOT reliably after a change — which is why a prompt's own
    /// `permissionMode` is read as the same fact (#629). The `mode` record beside it in the same
    /// file is NOT this: it carries `normal` and names a different axis.
    case permissionMode(String)
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
        case "queue-operation":
            return .queueOperation
        case "permission-mode":
            return record.stringField("permissionMode")
                .map(TranscriptRecord.permissionMode) ?? .unknown(raw: line)
        default:
            return .unknown(raw: line)
        }
    }
}

extension TranscriptRecord {
    /// The working directory this record reports, for the kinds that carry one. Read by discovery
    /// off a transcript's opening lines, which is the cheapest place the fact exists.
    var cwd: String? {
        switch self {
        case let .user(record), let .assistant(record), let .attachment(record):
            record.cwd
        case .aiTitle, .lastPrompt, .queueOperation, .permissionMode, .unknown:
            nil
        }
    }
}

extension MessageRecord {
    init(record: JSONValue) {
        let message = record["message"]
        self.uuid = record.stringField("uuid")
        self.parentUuid = record.stringField("parentUuid")
        self.originSessionID = record.stringField("session_id")
        self.cwd = record.stringField("cwd")
        self.gitBranch = record.stringField("gitBranch")
        self.timestampMs = ArgoEngine.timestampMs(record)
        self.authorship = Authorship(
            isMeta: record["isMeta"]?.bool == true,
            isCompactSummary: record["isCompactSummary"]?.bool == true,
            isSidechain: record["isSidechain"]?.bool == true,
        )
        self.entrypoint = record.stringField("entrypoint")
        self.permissionMode = record.stringField("permissionMode")
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
