import ArgoEngine

/// The transcript stream, as rows to draw.
///
/// It selects the kinds this feed draws, pairs each call with the outcome that answered it, and
/// hands every character on untouched.
package enum FeedProjection {
    /// Rows in the stream's own order. Nothing is sorted, nothing is promoted, and an event kind
    /// with no row yet contributes none rather than a placeholder.
    /// `working`, `handedOff`, `expired` and the question `asking` is holding are the inputs that
    /// are not the record's — a Turn in progress (`FeedWorking`), a handoff (`CONTEXT.md` L2), a
    /// Permission Argo's own gate refused (#573), and a question it is still holding (#1190). No
    /// CLI wrote a word about any of them, so they arrive beside the stream rather than being
    /// looked for inside it.
    package static func rows(
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
        // The gallery next, over a stream the survey has already left every picture out of: its
        // break rule is the wider of the two, so no call is counted here and drawn there.
        // The Turn's own fold LAST, over what all of those left behind: it reads the Turn
        // boundaries out of the rows, and every pass above it takes rows away without moving one
        // across a prompt or a stop reason. Then the runs of looking that the card left standing
        // next to each other are read as the one stretch they now are.
        let looked = FeedSurveyFold.folded(toldApart(FeedCallRun.collapsed(read)).contents)
        let shown = FeedUnreadableRun.folded(FeedGalleryFold.galleried(looked))
        let work = offering(FeedSurveyFold.rejoined(FeedWorkFold.folded(shown)), asking)
        // The link goes BELOW the roll-up, at the very foot.
        return (work + standing(asking, over: work) + startingUp(starting) +
            inFlight(working, over: work) + unanswered(expired) +
            rolledUp(events) + chained(handedOff)).enumerated()
            .map { position, content in
                FeedRow(id: position, content: content)
            }
    }

    /// The Turn still running, under what it has done and ABOVE the statements at the foot. Those
    /// are facts about the whole reading and this is the newest moment of it, so it keeps the place
    /// the next row will take when the record catches up — which is what makes it read as the
    /// reading continuing rather than as a footnote about it.
    ///
    /// A question the gate is holding sits above it on the same argument and wins the tie: a Turn
    /// waiting on an answer is not thinking, and the thing the reader has to act on goes nearer the
    /// work than the thing they only have to watch.
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
             .model, .effort, .branch, .mode, .entry, .turnEnded, .interrupted, .plan, .compaction,
             .queued,
             .unreadableLine, .skillLoaded, .excerpted: nil
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
        let opening = openingRunFacts(in: events)
        return events.enumerated().compactMap { index, event in
            if let fact = runFact(of: event) {
                return opening.contains(index) ? nil : .mark(.runFactChanged(fact))
            }
            return content(of: event, answeredBy: answered, within: within)
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
        case let .prompt(text, images, _):
            .prompt(text: text, shots: images.map(FeedShot.pasted))
        // An interrupt arrives on the user side of the record, and the ENGINE is what reads it as
        // the boundary it is (#1189) — a Turn ended there, which is a fact this surface is not the
        // only one that needs. All that is left here is the punctuation it draws as, in place of a
        // row in the reader's own voice saying something they never typed (#541).
        case .interrupted: .mark(.interrupted)
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
        // `.model` and `.effort` are read by `contents(of:)` above, which is the one place that
        // can tell an opening reading from a change — this switch sees one event at a time.
        case .toolCallOutcome, .usage, .recordIdentity, .headLeaf, .originSession, .title, .cwd,
             .model, .effort, .branch, .mode, .entry, .plan, .queued: nil
        }
    }
}
