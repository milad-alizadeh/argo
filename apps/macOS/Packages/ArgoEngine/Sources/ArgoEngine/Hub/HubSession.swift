import Foundation

/// The Session facts the shell can establish directly from one transcript stream.
public struct HubSession: Equatable, Identifiable, Sendable {
    public let id: String
    public let sourceURL: URL
    /// A Session read off a transcript is `external` by construction: the file is all Argo has of
    /// it, and there is no PTY behind a file. `managed` arrives with the spawner that owns one.
    public let provenance: SessionProvenance
    public private(set) var title: String
    public private(set) var cwd: String?
    public private(set) var model: String?
    public private(set) var branch: String?
    public private(set) var headLeafUUID: String?
    private var hasPromptTitle = false
    private var hasExplicitTitle = false
    private var turnOpen = false
    private var lastStop: StopReason?

    /// The rollup, derived on read: the Turn boundaries are what the transcript says, and the
    /// status is only ever a reading of them.
    public var status: SessionStatus {
        SessionStatus.observed(turnOpen: turnOpen, lastStop: lastStop)
    }

    public init(
        observation: TranscriptObservation,
        provenance: SessionProvenance = .external,
    ) {
        self.id = observation.id
        self.sourceURL = observation.sourceURL
        self.provenance = provenance
        self.title = observation.sourceURL.deletingPathExtension().lastPathComponent
    }

    mutating func apply(_ event: TranscriptEvent) {
        switch event {
        case .recordIdentity:
            break
        case let .headLeaf(uuid):
            headLeafUUID = uuid
        case let .title(observedTitle):
            title = observedTitle
            hasExplicitTitle = true
        case let .cwd(observedCwd):
            cwd = observedCwd
        case let .model(observedModel):
            model = observedModel
        case let .branch(observedBranch):
            branch = observedBranch
        case let .prompt(text, _):
            applyPromptTitle(text)
            turnOpen = true
        case let .turnEnded(reason):
            turnOpen = false
            lastStop = reason
        case .message, .thought, .toolCall, .toolCallOutcome, .plan, .compaction,
             .unreadableLine:
            break
        }
    }

    mutating func mergeContinuation(_ continuation: HubSession) {
        if continuation.hasExplicitTitle {
            title = continuation.title
            hasExplicitTitle = true
        } else if !hasExplicitTitle, !hasPromptTitle, continuation.hasPromptTitle {
            title = continuation.title
            hasPromptTitle = true
        }
        cwd = continuation.cwd ?? cwd
        model = continuation.model ?? model
        branch = continuation.branch ?? branch
        headLeafUUID = continuation.headLeafUUID ?? headLeafUUID
        // The continuation is where the chain is NOW, so its Turn boundaries are the ones the
        // status reads — but only once it HAS one. A resume file with nothing in it yet says
        // nothing about the chain, and taking its silence would close the root's open Turn.
        if continuation.turnOpen || continuation.lastStop != nil {
            turnOpen = continuation.turnOpen
            lastStop = continuation.lastStop
        }
    }

    private mutating func applyPromptTitle(_ text: String) {
        guard !hasExplicitTitle, !hasPromptTitle,
              let firstLine = text.split(whereSeparator: \.isNewline).first
        else { return }
        let candidate = String(firstLine).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !candidate.isEmpty else { return }
        title = candidate
        hasPromptTitle = true
    }
}
