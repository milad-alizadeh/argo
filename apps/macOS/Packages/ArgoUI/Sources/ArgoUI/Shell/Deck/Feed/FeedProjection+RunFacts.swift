import ArgoEngine

/// Telling a run fact that MOVED from the one the Session opened on (#558).
///
/// Its own file rather than two more methods on `FeedProjection`: it is the one reading in the feed
/// that needs to know where an event sits in the stream rather than only what it says, and every
/// other case in `content(of:)` is answered from the event alone.
extension FeedProjection {
    /// Which of the two run-fact events this is, or `nil` for every other event.
    static func runFact(of event: TranscriptEvent) -> FeedRunFact? {
        switch event {
        case let .model(id): .model(id)
        case let .effort(cli): .effort(cli)
        default: nil
        }
    }

    /// Where each fact was FIRST read, which is the Session's opening value and not news.
    ///
    /// Dropped by INDEX rather than by comparing values, because the cursor upstream already emits
    /// each fact on change alone: the first event of a kind is the opening reading, and every one
    /// after it is a change by construction. Comparing again here would be a second answer to a
    /// question already settled, and it would disagree the moment a resume chain re-states a value.
    ///
    /// The two are counted SEPARATELY: a model that moved before any effort was read must not
    /// consume the effort's own opening reading.
    static func openingRunFacts(in events: [TranscriptEvent]) -> Set<Int> {
        var opening = Set<Int>()
        var seenModel = false
        var seenEffort = false
        for (index, event) in events.enumerated() {
            switch event {
            case .model where !seenModel:
                seenModel = true
                opening.insert(index)
            case .effort where !seenEffort:
                seenEffort = true
                opening.insert(index)
            default:
                continue
            }
        }
        return opening
    }
}
