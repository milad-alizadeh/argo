import ArgoEngine

/// The transcript stream, as rows to draw.
///
/// It selects the kinds this feed draws, pairs each call with the outcome that answered it, and
/// hands every character on untouched.
enum FeedProjection {
    /// Rows in the stream's own order. Nothing is sorted, nothing is promoted, and an event kind
    /// with no row yet contributes none rather than a placeholder.
    /// `working`, `handedOff` and `expired` are the inputs that are not the record's — a Turn in
    /// progress (`FeedWorking`), a handoff (`CONTEXT.md` L2), and a Permission Argo's own gate
    /// refused (#573). No CLI wrote a word about any of them, so they arrive beside the stream
    /// rather than being looked for inside it.
    static func rows(
        from events: [TranscriptEvent],
        working: Bool = false,
        starting: Bool = false,
        handedOff: FeedHandoff? = nil,
        expired: [PermissionExpiry] = [],
        asking: FeedAskProjection.Asking = .none,
    )
        -> [FeedRow] {
        let read = contents(of: events)
        // In this order, and the order is load-bearing. Collapse a run of one call first, so the
        // survey counts the work rather than the lines left over from it; tell same-named files
        // apart BEFORE the fold, so a read that ends up inside a survey still carries the parent
        // its captions need — after the fold its filename is no longer in the feed to compare.
        // The gallery last, over a stream the survey has already left every picture out of: its
        // break rule is the wider of the two, so no call is counted here and drawn there.
        let work = offering(
            FeedUnreadableRun.folded(
                FeedGalleryFold.galleried(
                    FeedSurveyFold.folded(toldApart(FeedCallRun.collapsed(read)).contents),
                ),
            ),
            asking,
        )
        // The link goes BELOW the roll-up, at the very foot.
        return (work + startingUp(starting) + inFlight(working, over: work) + unanswered(expired) +
            rolledUp(events) + chained(handedOff)).enumerated()
            .map { position, content in
                FeedRow(id: position, content: content)
            }
    }

    /// The Turn still running, directly under what it has done and ABOVE the three statements below
    /// it. Those are facts about the whole reading and this is the newest moment of it, so it keeps
    /// the place the next row will take when the record catches up — which is what makes it read as
    /// the reading continuing rather than as a footnote about it.
    ///
    /// A Turn in flight is EITHER running a tool or thinking, never both, so the row stands down
    /// while a call is pending: the ion crosses that call's own line instead (`FeedCallLineIon`).
    /// The split is here and nowhere else — a Turn goes pending and resolves many times over, and
    /// two surfaces each deciding would both draw at some point in the handover.
    private static func inFlight(_ working: Bool, over rows: [FeedRow.Content])
        -> [FeedRow.Content] {
        working && !rows.contains(where: \.kind.isCallInFlight) ? [.mark(.working)] : []
    }

    /// The CLI coming up, in place of the `FeedSilence` an empty reading would otherwise draw
    /// (#587). By construction it IS the whole reading: a Session Argo is still waiting on has
    /// written no record for anything to sit above it.
    private static func startingUp(_ starting: Bool) -> [FeedRow.Content] {
        starting ? [.mark(.starting)] : []
    }

    private static func chained(_ handedOff: FeedHandoff?) -> [FeedRow.Content] {
        handedOff.map { [.mark(.handedOff($0))] } ?? []
    }

    /// The calls the gate refused because nobody answered, at the foot of the work they interrupted
    /// and above the roll-up, in the order they expired.
    ///
    /// At the foot rather than in place, and that is a limit: the hook payload names a tool and its
    /// input, never the record's own id for the call, so there is no honest position in the stream
    /// to put the row at.
    private static func unanswered(_ expired: [PermissionExpiry]) -> [FeedRow.Content] {
        expired.map { .mark(.permissionExpired($0)) }
    }

    /// What the Session spent, at the foot of the reading.
    ///
    /// At the FOOT, the one thing in the feed not in chronological position. A Session whose record
    /// reported no spend gets no marker at all: a roll-up reading zero would claim the work was
    /// free rather than that nobody said what it cost.
    ///
    /// BOTH grains: the turns' own spend, and the delegated spend that only ever appears on the
    /// call that handed the work over. Summed from what the record reported and nothing else.
    ///
    /// Nothing at all on a BOUNDED reading — the withholding named once, on the predicate, and
    /// spent here and by the header alike (`[TranscriptEvent].isBoundedReading`).
    private static func rolledUp(_ events: [TranscriptEvent]) -> [FeedRow.Content] {
        guard !events.isBoundedReading else { return [] }
        let spent = events.reduce(nil) { running, event -> Usage? in
            Usage.total(running, reported(in: event))
        }
        return spent.map { [.mark(.spent($0))] } ?? []
    }

    private static func reported(in event: TranscriptEvent) -> Usage? {
        switch event {
        case let .usage(usage): usage
        case let .toolCallOutcome(outcome): outcome.usage
        case .prompt, .message, .thought, .toolCall, .recordIdentity, .headLeaf, .originSession,
             .title, .cwd,
             .model, .branch, .mode, .turnEnded, .plan, .compaction, .queued, .unreadableLine,
             .skillLoaded, .excerpted: nil
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

    /// Every row the record itself could put in the feed, in the record's own order, BEFORE any
    /// fold takes one out of it. The stage every pass above runs over.
    static func contents(of events: [TranscriptEvent]) -> [FeedRow.Content] {
        let answered = outcomes(in: events)
        let within = workingDirectory(in: events)
        return events.compactMap { content(of: $0, answeredBy: answered, within: within) }
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
        case let .prompt(text, images, _):
            if ClaudeInterrupt.isMark(text) {
                .mark(.interrupted)
            } else {
                .prompt(text: text, shots: images.map(FeedShot.pasted))
            }
        // In the sequence it happened, beside the user's own line rather than instead of it: a
        // command is just a prompt, and the feed invents no third way of showing one (#688).
        case let .skillLoaded(load): .skillLoaded(FeedSkillLoad(load, within: path))
        case let .message(markdown): .message(markdown)
        // A separate case from `.message` on purpose, and it stays separate: the two carry the
        // same words often enough that collapsing them would read a turn's reasoning as its answer.
        case let .thought(markdown): .thought(markdown)
        case let .toolCall(call):
            asked(call, answeredBy: outcomes) ?? FeedCallReading
                .call(call, outcome: outcomes[call.id], within: path)
                .map(FeedRow.Content.call)
        // Punctuation: what happened TO the reading rather than in it. Each stays exactly where the
        // record put it.
        case .compaction: .mark(.compacted)
        case let .turnEnded(reason): .mark(.turnEnded(reason))
        // A line nothing could parse. It gets a row rather than being dropped: the line existed,
        // something wrote it, and a feed that skips it silently cannot tell a Session that was
        // quiet from a record this reader came up short on.
        case let .unreadableLine(raw): .unreadable(FeedUnreadable(lines: [raw]))
        // None of these is news of its own: an outcome is carried by the call's row, a spend is one
        // term of the roll-up at the foot, and a queue note says how the prompt below it arrived.
        // The stance is one of these too, and pointedly: Mode is standing rather than something
        // that happened, so it belongs on the composer's footer and not as a row in the reading.
        // The seam of a bounded read, drawn where it happened: everything above it is older than
        // everything below it, with a stretch of the record missing between the two.
        case .excerpted: .mark(.excerpted)
        case .toolCallOutcome, .usage, .recordIdentity, .headLeaf, .originSession, .title, .cwd,
             .model, .branch, .mode, .plan, .queued: nil
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

    /// What every ask row is told about answering (#712). Over the WHOLE feed rather than per row,
    /// because both facts are about the feed a row sits in: whether this Session can be driven at
    /// all reaches every ask row, and the gate's live question reaches exactly one.
    ///
    /// The LAST match wins. Two identical questions in one Session both match by value — there is
    /// no id either side shares — and the newest is the one still waiting.
    private static func offering(
        _ contents: [FeedRow.Content],
        _ asking: FeedAskProjection.Asking,
    )
        -> [FeedRow.Content] {
        let held = contents.lastIndex { waits(for: asking.live, $0) }
        return contents.enumerated().map { position, content in
            guard case let .ask(ask) = content else { return content }
            return .ask(FeedAsk(
                ask: ask.ask,
                isAnswered: ask.isAnswered,
                answer: ask.answer,
                offer: FeedAskProjection.Asking(
                    live: position == held ? asking.live : nil,
                    isDriveable: asking.isDriveable,
                ),
            ))
        }
    }

    private static func waits(
        for live: FeedAskProjection.Live?,
        _ content: FeedRow.Content,
    )
        -> Bool {
        guard case let .ask(ask) = content else { return false }
        return ask.isPending && FeedAskProjection.matches(live, ask.ask)
    }
}
