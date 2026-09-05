import ArgoEngine

/// The transcript stream, as rows to draw.
///
/// It selects the kinds this feed draws, pairs each call with the outcome that answered it, and
/// hands every character on untouched.
package enum FeedProjection {
    /// Rows in the stream's own order. Nothing is sorted, nothing is promoted, and an event kind
    /// with no row yet contributes none rather than a placeholder.
    /// `working`, `handedOff`, `handoffFailures`, `expired`, the question `asking` is holding and
    /// the one `reported` carries are the inputs that are not the record's — a Turn in progress
    /// (`FeedWorking`), a handoff and the ones that failed (`CONTEXT.md` L2, #1327), a Permission
    /// Argo's own gate refused (#573), a question it is still holding (#1190), one the agent raised
    /// over the companion plugin (#1205), and a wait Argo held that has ended (#1323). No CLI wrote
    /// a word about any of them, so they arrive beside the stream rather than being looked for
    /// inside it.
    package static func rows(
        from events: [TranscriptEvent],
        working: Bool = false,
        startedQuietly: Bool = false,
        settledWaits: [SessionWaitSettled] = [],
        handoffFailures: [SessionWaitSettled] = [],
        handedOff: FeedHandoff? = nil,
        expired: [PermissionExpiry] = [],
        asking: FeedAskProjection.Asking = .none,
        reported: Ask? = nil,
    )
        -> [FeedRow] {
        let read = contents(of: events)
        // In this order, and the order is load-bearing. Collapse a run of one call first, so the
        // survey counts the work rather than the lines left over from it; tell same-named files
        // apart BEFORE the fold, so a read that ends up inside a survey still carries the parent
        // its captions need — after the fold its filename is no longer in the feed to compare.
        // The gallery next, over a stream the survey has already left every picture out of: its
        // break rule is the wider of the two, so no call is counted here and drawn there. It also
        // takes the prompt rows that hold nothing but pictures, and hands back a gallery that is
        // still a prompt — which is what leaves the Turn boundary below it where it was.
        // The Turn's own fold LAST, over what all of those left behind: it reads the Turn
        // boundaries out of the rows, and every pass above it takes rows away without moving one
        // across a prompt or a stop reason. Then the runs of looking that the card left standing
        // next to each other are read as the one stretch they now are.
        let looked = FeedSurveyFold.folded(toldApart(FeedCallRun.collapsed(read)).contents)
        let shown = FeedUnreadableRun.folded(FeedGalleryFold.galleried(looked))
        let work = offering(FeedSurveyFold.rejoined(FeedWorkFold.folded(shown)), asking)
        // The link goes at the very foot.
        // The gate's question first, and the reported one read against the work AND it: the two
        // channels share no id, so the only thing that can tell one question from two is the words.
        let held = standing(asking, over: work)
        let foot = wentQuiet(startedQuietly) + inFlight(working, over: work) +
            unanswered(expired) + handoffEndings(handoffFailures) + chained(handedOff)
        let contents = opening(settledWaits) + work + held +
            self.reported(reported, asking, over: work + held) + foot
        return contents.enumerated().map { position, content in
            FeedRow(id: position, content: content)
        }
    }

    /// The waits that ended BEFORE the record did anything, at the head of the reading where they
    /// happened (#1323). One row each, appended by the projection and never edited afterwards: the
    /// reading is written once, and the plinth is what carried the wait while it ran.
    ///
    /// Every wait this ships is one of those: Argo starts a CLI and waits for its first byte, which
    /// by construction comes before the first record. The other waits the design names end
    /// elsewhere in the reading, and each arrives with its own ticket and its own position.
    private static func opening(_ settled: [SessionWaitSettled]) -> [FeedRow.Content] {
        settled.map { .settledWait($0) }
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

    /// The row that lands once the wait for the CLI's first byte runs out (#1245).
    ///
    /// Never beside the plinth that carried that wait: the engine publishes the two on either side
    /// of one limit, so the feed can no more draw both than the Session can be in both states.
    ///
    /// Never beside the WORKING row either, and that is the engine's doing rather than this
    /// function's: a Turn typed at a PTY Argo has never heard is not reported `running`
    /// (`HubSession.statusReading`), so a reading cannot arrive here claiming both that the agent
    /// is thinking and that it has printed nothing.
    private static func wentQuiet(_ startedQuietly: Bool) -> [FeedRow.Content] {
        startedQuietly ? [.mark(.startedQuietly)] : []
    }

    private static func chained(_ handedOff: FeedHandoff?) -> [FeedRow.Content] {
        handedOff.map { [.mark(.handedOff($0))] } ?? []
    }

    /// The handoffs Argo attempted here that did NOT land (#1327), at the foot beside the link a
    /// landed one leaves — never at the head with `starting` and `resuming`: those two wait for a
    /// process that has not written a record yet, and a handoff runs well after one has.
    private static func handoffEndings(_ failures: [SessionWaitSettled]) -> [FeedRow.Content] {
        failures.map { .settledWait($0) }
    }

    /// The calls the gate refused because nobody answered, at the foot of the work they
    /// interrupted, in the order they expired.
    ///
    /// At the foot rather than in place, and that is a limit: the hook payload names a tool and its
    /// input, never the record's own id for the call, so there is no honest position in the stream
    /// to put the row at.
    private static func unanswered(_ expired: [PermissionExpiry]) -> [FeedRow.Content] {
        expired.map { .mark(.permissionExpired($0)) }
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
    ///
    /// A Turn that ends without an answer lands one EXTRA row here beside the ordinary
    /// `.mark(.turnEnded)` rule — the settled half of the plinth's `.thinking` wait
    /// (`cockpit-feed-waiting.md`). A Turn that answers drops nothing: the agent's own words are
    /// the record of it.
    static func contents(of events: [TranscriptEvent]) -> [FeedRow.Content] {
        let answered = outcomes(in: events)
        let within = workingDirectory(in: events)
        let opening = openingRunFacts(in: events)
        // Where the Turn now ending last opened, and the last moment anything of it was clocked —
        // both read off the stream in the order it happened, since nothing outside it is in hand
        // here. Reset at every open so a Turn that runs long is timed from ITS OWN start rather
        // than the one before it.
        var turnOpenedAtMs: Int?
        var lastClockedAtMs: Int?
        return events.enumerated().flatMap { index, event -> [FeedRow.Content] in
            if let fact = runFact(of: event) {
                return opening.contains(index) ? [] : [.mark(.runFactChanged(fact))]
            }
            switch event {
            case let .prompt(_, _, atMs), let .turnResumed(atMs):
                turnOpenedAtMs = atMs
                lastClockedAtMs = atMs ?? lastClockedAtMs
            case let .toolCall(call):
                lastClockedAtMs = call.atMs ?? lastClockedAtMs
            case let .toolCallOutcome(outcome):
                lastClockedAtMs = outcome.endedAtMs ?? lastClockedAtMs
            case let .interrupted(atMs), let .compaction(atMs):
                lastClockedAtMs = atMs ?? lastClockedAtMs
            // Nothing this pass clocks a Turn by: none of these is a moment work happened at, or
            // the moment already rides on a case above (`.turnEnded`'s own reading is `atMs`-less;
            // the failed row's duration is read off the LAST clocked activity instead).
            case .recordIdentity, .headLeaf, .originSession, .title, .cwd, .model, .effort,
                 .branch, .entry, .mode, .message, .thought, .skillLoaded, .turnEnded, .queued,
                 .usage, .plan, .unreadableLine, .superseded, .excerpted:
                break
            }
            var produced: [FeedRow.Content] = []
            if let one = content(of: event, answeredBy: answered, within: within) {
                produced.append(one)
            }
            if case let .turnEnded(reason) = event, let hostWord = answerlessReason(reason) {
                produced.append(.settledWait(SessionWaitSettled(
                    wait: .thinking,
                    tookMs: max((lastClockedAtMs ?? 0) - (turnOpenedAtMs ?? 0), 0),
                    failure: hostWord,
                )))
            }
            return produced
        }
    }

    /// The host's own word for a Turn that ended with nothing to show for it — never `endTurn`,
    /// which is the agent finishing, and never `cancelled`, which the feed already draws as
    /// `.interrupted` (#1189). `nil` for `unknown` too: a word this vocabulary could not read is
    /// not evidence the Turn went unanswered.
    private static func answerlessReason(_ reason: StopReason) -> String? {
        switch reason {
        case .maxTokens, .maxTurnRequests, .refusal: reason.rawValue
        case .endTurn, .cancelled, .unknown: nil
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
            // Read here, ahead of the generic MCP reading below, on `asked(call:)`'s own terms:
            // the one companion tool whose input is a claim gets its own row rather than the
            // bare "argo · report_ready" the generic reading would draw (#1335).
            call.readyClaim.map { .mark(.readyToShip($0)) }
                ?? asked(call, answeredBy: outcomes)
                ?? FeedCallReading
                .call(call, outcome: outcomes[call.id], within: path)
                .map(FeedRow.Content.call)
        // Punctuation: what happened TO the reading rather than in it. Each stays exactly where the
        // record put it.
        case .compaction: .mark(.compacted)
        case .turnEnded: .mark(.turnEnded)
        // A line nothing could parse. It gets a row rather than being dropped: the line existed,
        // something wrote it, and a feed that skips it silently cannot tell a Session that was
        // quiet from a record this reader came up short on.
        case let .unreadableLine(raw): .unreadable(FeedUnreadable(lines: [raw]))
        // None of these is news of its own: an outcome is carried by the call's row, a spend is
        // the deck header's to state (#1248), and a queue note says how the prompt below it
        // arrived.
        // The stance is one of these too, and pointedly: Mode is standing rather than something
        // that happened, so it belongs on the composer's footer and not as a row in the reading.
        // The seam of a bounded read, drawn where it happened: everything above it is older than
        // everything below it, with a stretch of the record missing between the two.
        case .excerpted: .mark(.excerpted)
        // `.model` and `.effort` are read by `contents(of:)` above, which is the one place that
        // can tell an opening reading from a change — this switch sees one event at a time.
        // `.superseded` never reaches a projection at all: it is spent where the reading is built,
        // taking the abandoned branch out of the stream this switch is handed (#1202).
        // `.turnResumed` is among them: the Turn a report re-opened is a boundary the Hub and the
        // roster read (#1299), and the report itself is already drawn here as the delegating call's
        // own row — a second mark beside it would say the same thing twice.
        case .toolCallOutcome, .usage, .recordIdentity, .headLeaf, .originSession, .title, .cwd,
             .model, .effort, .branch, .mode, .entry, .plan, .queued, .superseded, .turnResumed:
            nil
        }
    }
}
