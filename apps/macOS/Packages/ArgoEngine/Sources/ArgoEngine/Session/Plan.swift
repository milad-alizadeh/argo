public enum PlanEntryStatus: String, Sendable, Equatable {
    case pending
    case inProgress
    case completed
}

public struct PlanEntry: Sendable, Equatable {
    public let text: String
    public let status: PlanEntryStatus

    public init(text: String, status: PlanEntryStatus) {
        self.text = text
        self.status = status
    }
}

/// The agent-authored live to-do list. Session-scoped and agent-replaced whole (ADR-0020): the
/// host delivers the COMPLETE entry list each time, so a plan is never patched, only superseded.
public struct Plan: Sendable, Equatable {
    public let entries: [PlanEntry]

    public init(entries: [PlanEntry]) {
        self.entries = entries
    }
}
