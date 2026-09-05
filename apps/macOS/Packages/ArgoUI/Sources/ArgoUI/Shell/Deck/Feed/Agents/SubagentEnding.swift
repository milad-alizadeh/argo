import ArgoEngine

/// What the Subagent's OWN record says about whether it stopped (#1392).
///
/// `SubagentWriting` reads when the child's file last GREW; this reads what it SAYS. The two are
/// sourced differently and answer different questions, so they stay two readings.
///
/// One-directional, as both the facts beside it are: it only ever says a delegation STOPPED. A
/// record left mid-tool says the child had not finished when it was written, which is a fact about
/// then.
///
/// **Prose counts as an ending, and not only `turnEnded`.** Of 575 finished Subagent records on
/// this machine, 230 carry a stop reason and 332 end on a final message with none, under CLI
/// versions 2.1.224 to 2.1.261; reading only the stop reason would leave 58% of finished children
/// on the ceiling. Reading both reaches 562 of the 575. An agent that emits text and calls nothing
/// has ended its Turn, which is what the host's own `end_turn` states where it states anything.
///
/// **It takes both halves, and the other half is `SubagentWriting.quiet`** — the ranking is
/// `FeedAgents.told(_:writing:ending:at:)`. The CLI splits one assistant message across a record
/// per content block, so a live child's file passes through "ends in prose" on its way to the tool
/// call in the same message: 4,494 such moments in those same records, half of them under two
/// seconds. Growth is what tells those from an ending.
///
/// **The residue, so it does not read as fixed:** a child KILLED mid-write emits no ending at all,
/// and the 13 of 575 whose record stops on a tool result do not either. Those still wait for
/// `DelegationCeiling`. Nothing here invalidates the rail on a timer; the common case needs none,
/// because the child's last batch republishes the readings and the rail re-derives on that pass.
enum SubagentEnding: Equatable, Sendable {
    /// The child's record closes: the host reported a stop, somebody interrupted it, or it said its
    /// piece and called nothing.
    case stopped
    /// It does not say. A record left mid-tool, and the ordinary case of a child Argo has no
    /// reading of at all — including one whose id resolves to two files, which
    /// `SubagentReadings.reading(of:)` answers with nothing.
    case open

    /// What the child's reading ends on, or `open` where Argo has none.
    ///
    /// BACKWARDS to the last event that is about the work: a record's own bookkeeping trails what
    /// it said — the prose, then the spend, then the stop reason — so a reading walked forwards to
    /// its final element would answer on the spend.
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
    /// Switched with no `default`, as `endsTurn` is: an event added to the domain has to say
    /// whether it is an ending, a sign of work, or neither.
    var ending: SubagentEnding? {
        switch self {
        // The endings. `.message` joins the two boundary marks per the note on the type.
        case .turnEnded, .interrupted, .message: .stopped
        // Work, in progress as of this event: a call, its result, the thinking before one, the
        // prompt that started it, a Plan written to do it, and the marks that keep it going.
        case .toolCall, .toolCallOutcome, .thought, .prompt, .plan, .skillLoaded, .turnResumed,
             .queued, .compaction:
            .open
        // Neither. What the record notes about itself, its Session and its cost — true whatever the
        // child is doing.
        case .recordIdentity, .headLeaf, .originSession, .title, .cwd, .model, .effort, .branch,
             .entry, .mode, .usage, .unreadableLine, .superseded, .excerpted:
            nil
        }
    }
}
