import ArgoEngine

/// What the Subagent's OWN record says about whether it stopped (#1392).
///
/// The evidence between the two the rail already had. `SubagentWriting` is the child's file MOVING,
/// which only ever gives a running claim; `DelegationCeiling` is an age, which takes one away four
/// hours later. Neither reads what the child actually wrote — so a fan-out whose closing
/// `task-notification` never landed stood green for hours over four children that had each filed a
/// report and stopped. This reads that report.
///
/// **One-directional, exactly as both of those are.** It only ever says a delegation STOPPED, on
/// the evidence of the child's own last words. It never claims one is running: a record that ends
/// mid-tool says the child had not finished when it was written, which is a fact about then.
///
/// **Prose is a stop because that is what ends a Turn.** An agent that emits text and calls nothing
/// has no reason to be resumed, and the host's own `end_turn` says so — where it says anything. Of
/// 575 Subagent records on this machine that had finished, 230 carry that stop reason and 332 end
/// in a bare final message with none; 562 of the 575 are reached by reading either as an ending,
/// and the 13 that are not end in a tool result and fall through to the two facts above.
///
/// **Read WITH `SubagentWriting`, never instead of it** — the ranking is
/// `FeedAgents.told(_:writing:ending:at:)`, and the reason is in the record's shape. The CLI splits
/// one assistant message across a record per content block, so a live child's file passes through
/// "ends in prose" on its way to the tool call in the same message: 4,494 such moments in those
/// same records, half of them lasting two seconds. Growth is what tells those apart, and it is
/// asked first — so this reaches a delegation only once the file has also gone quiet, which is
/// minutes rather than the four hours it replaces.
enum SubagentEnding: Equatable, Sendable {
    /// The child's record closes: the host reported a stop, somebody interrupted it, or it said its
    /// piece and called nothing.
    case stopped
    /// It does not say. A record that ends mid-tool, and the ordinary case of a child Argo has no
    /// reading of at all — absence of evidence, which is why it settles nothing on its own.
    case open

    /// What the child's reading ends on, or `open` where Argo has none.
    ///
    /// BACKWARDS to the last event that is about the work, because a record's own bookkeeping
    /// trails what it said: an assistant record emits its prose, then what it spent, then the stop
    /// reason, and a reading walked forwards to its final element would answer on the spend.
    static func read(_ events: [TranscriptEvent]?) -> SubagentEnding {
        guard let events else { return .open }
        for event in events.reversed() {
            if let ending = event.ending {
                return ending
            }
        }
        return .open
    }
}

private extension TranscriptEvent {
    /// Whether this event decides the reading, and `nil` for one that says nothing about the work
    /// either way — the bookkeeping the walk above steps over.
    ///
    /// Switched with no `default`, for the reason `endsTurn` has none: an event added to the domain
    /// has to say whether it is an ending, a sign of work, or neither, rather than inheriting an
    /// answer written for the events that exist today.
    var ending: SubagentEnding? {
        switch self {
        // The endings. `.message` joins the two boundary marks because a Turn is over when the
        // agent speaks and calls nothing — see the note on the type.
        case .turnEnded, .interrupted, .message: .stopped
        // Work, in progress as of this event: a call, its result, the thinking before one, the
        // prompt that started it, a Plan written to do it, and the marks that keep it going.
        case .toolCall, .toolCallOutcome, .thought, .prompt, .plan, .skillLoaded, .turnResumed,
             .queued, .compaction:
            .open
        // Neither. What the record notes about itself, its Session and its cost — true whatever the
        // child is doing, so it cannot be read as either answer.
        case .recordIdentity, .headLeaf, .originSession, .title, .cwd, .model, .effort, .branch,
             .entry, .mode, .usage, .unreadableLine, .superseded, .excerpted:
            nil
        }
    }
}
