import ArgoEngine

/// The transcript stream, as rows to draw.
///
/// Still deliberately thin: it selects the kinds this feed draws, pairs each call with the outcome
/// that answered it, and hands every character on untouched. Everything a richer feed will want —
/// folding a turn, grouping a run of edits — is a later ticket's, and each of them is a way this
/// could stop being a reading of the record.
enum FeedProjection {
    /// Rows in the stream's own order. Nothing is sorted, nothing is promoted, and an event kind
    /// with no row yet contributes none rather than a placeholder — a surface that drew "tool call"
    /// in a box would be claiming a shape the ticket that owns it has not decided.
    /// `working`, `handedOff` and `expired` are the inputs that are not the record's. All three are
    /// Argo's own reading: a Turn in progress (`FeedWorking`), a handoff (`CONTEXT.md` L2), and a
    /// Permission Argo's gate refused when its patience ran out (#573). No CLI wrote a word about
    /// any of them, so they arrive beside the stream rather than being looked for inside it. All
    /// three are absent for almost every Session.
    static func rows(
        from events: [TranscriptEvent],
        working: Bool = false,
        handedOff: FeedHandoff? = nil,
        expired: [PermissionExpiry] = [],
    )
        -> [FeedRow] {
        let answered = outcomes(in: events)
        let within = workingDirectory(in: events)
        let read = events.compactMap { content(of: $0, answeredBy: answered, within: within) }
        // In this order, and the order is load-bearing. Collapse a run of one call first, so the
        // survey counts the work rather than the lines left over from it; tell same-named files
        // apart BEFORE the fold, so a read that ends up inside a survey still carries the parent
        // its captions need — after the fold its filename is no longer in the feed to compare.
        // The gallery last, over a stream the survey has already left every picture out of: its
        // break rule is the wider of the two, so no call is counted here and drawn there.
        let work = FeedUnreadableRun.folded(
            FeedGalleryFold.galleried(
                FeedSurveyFold.folded(toldApart(FeedCallRun.collapsed(read))),
            ),
        )
        // The link goes BELOW the roll-up, at the very foot. Both are facts about the whole Session
        // rather than moments in it, and of the two this is the one a reader acts on: what the work
        // cost is the last thing said about the reading, and where the work went is the way out of
        // it.
        return (work + inFlight(working) + unanswered(expired) + rolledUp(events) +
            chained(handedOff)).enumerated()
            .map { position, content in
                FeedRow(id: position, content: content)
            }
    }

    /// The Turn still running, directly under what it has done and ABOVE the three statements below
    /// it. Those are facts about the whole reading and this is the newest moment of it, so it keeps
    /// the place the next row will take when the record catches up — which is what makes it read as
    /// the reading continuing rather than as a footnote about it.
    private static func inFlight(_ working: Bool) -> [FeedRow.Content] {
        working ? [.mark(.working)] : []
    }

    private static func chained(_ handedOff: FeedHandoff?) -> [FeedRow.Content] {
        handedOff.map { [.mark(.handedOff($0))] } ?? []
    }

    /// The calls the gate refused because nobody answered, at the foot of the work they interrupted
    /// and above the roll-up, in the order they expired.
    ///
    /// At the foot rather than in place, and that is a limit rather than a preference: the hook
    /// payload names a tool and its input, never the record's own id for the call, so there is no
    /// honest position in the stream to put the row at. What there IS is a true statement about the
    /// Session, and the feed already ends with two of those. A Session with a live gate is a live
    /// Session, so the foot is also where its reader is looking.
    private static func unanswered(_ expired: [PermissionExpiry]) -> [FeedRow.Content] {
        expired.map { .mark(.permissionExpired($0)) }
    }

    /// What the Session spent, at the foot of the reading.
    ///
    /// At the FOOT because it is a fact about the whole of it rather than about a moment in it —
    /// the one thing in the feed that is not in chronological position, because it has no position
    /// to be in. A Session whose record reported no spend gets no marker at all: a roll-up reading
    /// zero would claim the work was free rather than that nobody said what it cost.
    ///
    /// BOTH grains, which is what makes the word `session` on it true: the turns' own spend, and
    /// the delegated spend that only ever appears on the call that handed the work over. Summed
    /// from what the record reported and nothing else — every request is priced on its own, so
    /// adding them is what the total cost of a Session IS.
    private static func rolledUp(_ events: [TranscriptEvent]) -> [FeedRow.Content] {
        let spent = events.reduce(nil) { running, event -> Usage? in
            Usage.total(running, reported(in: event))
        }
        return spent.map { [.mark(.spent($0))] } ?? []
    }

    private static func reported(in event: TranscriptEvent) -> Usage? {
        switch event {
        case let .usage(usage): usage
        case let .toolCallOutcome(outcome): outcome.usage
        case .prompt, .message, .thought, .toolCall, .recordIdentity, .headLeaf, .title, .cwd,
             .model, .branch, .turnEnded, .plan, .compaction, .queued, .unreadableLine: nil
        }
    }

    /// Where the Session is working, which is what every address in the feed is said relative to.
    /// The LAST one the record carries: a resume chain can move, and the newest is where it is now.
    private static func workingDirectory(in events: [TranscriptEvent]) -> FeedPath {
        let cwd = events.reversed().compactMap { event -> String? in
            guard case let .cwd(path) = event else { return nil }
            return path
        }.first
        return FeedPath(cwd: cwd)
    }

    /// A call's result is read through its id rather than by position: the two events are written
    /// by two different records, and a run of parallel calls interleaves them.
    private static func outcomes(in events: [TranscriptEvent]) -> [String: ToolCallOutcome] {
        events.reduce(into: [:]) { found, event in
            guard case let .toolCallOutcome(outcome) = event else { return }
            found[outcome.id] = outcome
        }
    }

    /// The `switch` carries no `default`, so an event kind added to the domain fails this build
    /// rather than being silently dropped by the surface that should have drawn it.
    private static func content(
        of event: TranscriptEvent,
        answeredBy outcomes: [String: ToolCallOutcome],
        within path: FeedPath,
    )
        -> FeedRow.Content? {
        switch event {
        // An interrupt arrives on the user side of the record, so it is read here and turned into
        // punctuation rather than drawn as something the reader said (#541). The sentence is the
        // CLI's, which is why the engine owns it: this is a READING of the record, and a second
        // spelling of the marker living up here could drift from the keystroke that produces it.
        case let .prompt(text, _):
            if ClaudeInterrupt.isMark(text) {
                .mark(.interrupted)
            } else {
                .prompt(text)
            }
        case let .message(markdown): .message(markdown)
        // A separate case from `.message` on purpose, and it stays separate: the two carry the
        // same words often enough that collapsing them would read a turn's reasoning as its answer.
        case let .thought(markdown): .thought(markdown)
        case let .toolCall(call):
            asked(call, answeredBy: outcomes) ?? FeedCallReading
                .call(call, outcome: outcomes[call.id], within: path)
                .map(FeedRow.Content.call)
        // Punctuation: what happened TO the reading rather than in it. Each stays exactly where the
        // record put it — a turn's end that floated to the bottom would be a boundary drawn around
        // work it never contained.
        case .compaction: .mark(.compacted)
        case let .turnEnded(reason): .mark(.turnEnded(reason))
        // A line nothing could parse. It gets a row rather than being dropped: the line existed,
        // something wrote it, and a feed that skips it silently cannot tell a Session that was
        // quiet from a record this reader came up short on.
        case let .unreadableLine(raw): .unreadable(FeedUnreadable(lines: [raw]))
        // An outcome is not news of its own — it is what the call it answers produced, and that
        // call's row already carries it.
        // A spend is not news of its own either — it is one term of the roll-up at the foot of the
        // reading, and a row per request would punctuate the feed once per answer the agent gave.
        // A queue note is not news either: it says how the prompt below it ARRIVED, and the prompt
        // is already the row.
        case .toolCallOutcome, .usage, .recordIdentity, .headLeaf, .title, .cwd, .model, .branch,
             .plan, .queued: nil
        }
    }

    /// The question a call put, where it put one. Read BEFORE the call line, because a question is
    /// not work: drawn as `Called AskUserQuestion` it says the mechanism and never what was asked.
    private static func asked(
        _ call: ToolCall,
        answeredBy outcomes: [String: ToolCallOutcome],
    )
        -> FeedRow.Content? {
        FeedAskReading.asked(call, answeredBy: outcomes[call.id]).map(FeedRow.Content.ask)
    }

    /// Two files of the same name take the shortest parent that tells them apart — the roster's
    /// rule for two workspaces, shared (#419). Computed over the WHOLE feed rather than per row,
    /// because whether a name is ambiguous is a fact about the feed it sits in, not about the file.
    private static func toldApart(_ contents: [FeedRow.Content]) -> [FeedRow.Content] {
        let labels = DistinguishingLabel.labels(for: contents.map(path(in:)))
        return zip(contents, labels).map { content, label in qualified(content, as: label) }
    }

    private static func path(in content: FeedRow.Content) -> String? {
        guard case let .call(call) = content,
              case let .file(file) = call.subject else { return nil }
        return file.path
    }

    private static func qualified(_ content: FeedRow.Content, as label: String?) -> FeedRow
        .Content {
        guard case let .call(call) = content, case let .file(file) = call.subject, let label
        else { return content }
        return .call(call.naming(file.qualified(as: label)))
    }
}
