import Foundation

/// The Session facts the shell can establish directly from one transcript stream.
public struct HubSession: Equatable, Identifiable, Sendable {
    public let id: String
    public let sourceURL: URL
    public private(set) var title: String
    public private(set) var cwd: String?
    public private(set) var model: String?
    public private(set) var branch: String?
    public private(set) var headLeafUUID: String?
    private var hasPromptTitle = false
    private var hasExplicitTitle = false

    public init(observation: TranscriptObservation) {
        id = observation.id
        sourceURL = observation.sourceURL
        title = observation.sourceURL.deletingPathExtension().lastPathComponent
    }

    init(id: String, sourceURL: URL) {
        self.id = id
        self.sourceURL = sourceURL
        title = sourceURL.deletingPathExtension().lastPathComponent
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
