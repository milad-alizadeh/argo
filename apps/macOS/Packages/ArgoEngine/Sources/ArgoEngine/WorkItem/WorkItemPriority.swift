import Foundation

/// Where one provider's priority word sits on a ladder, for the one caller that has to ORDER two
/// tickets rather than group them (#273).
///
/// The words stay the provider's and stay verbatim on the `WorkItem` — nothing here recases or
/// rewrites one. This is the rung a word MATCHES, which is what ADR-0016 means by provider priority
/// being a sort Argo reflects: the ladder is Argo's, the words on it are not.
public enum WorkItemPriority: Equatable, Sendable {
    case high
    case medium
    case low
    /// A word the provider spells and this ladder does not know. It carries no word, because two
    /// unknown words are not ordered against each other: nothing has said which outranks the other.
    case other
    /// No priority word was read at all — lower than `other`, since absent is not a rung (ADR-0014,
    /// per-fact `unknown`).
    case unread

    /// The words the ladder knows, highest first. The ONE place they are listed — the backlog's
    /// bands match against this list too, so a header order and the hero's ranking cannot disagree.
    public static let known = ["high", "medium", "low"]

    /// Which rung a provider's word matches, folded for case: a tracker spelling it `High` names
    /// the same rung as `high`.
    public init(word: String?) {
        guard let word else {
            self = .unread
            return
        }
        switch word.lowercased() {
        case "high": self = .high
        case "medium": self = .medium
        case "low": self = .low
        default: self = .other
        }
    }

    /// Descending urgency, so the smaller number is the ticket to reach for first.
    public var rung: Int {
        switch self {
        case .high: 0
        case .medium: 1
        case .low: 2
        case .other: 3
        case .unread: 4
        }
    }
}

public extension WorkItem {
    /// Which rung this ticket's own word matches.
    var priorityRung: WorkItemPriority {
        WorkItemPriority(word: priority)
    }
}
