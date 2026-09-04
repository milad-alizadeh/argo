import ArgoEngine

extension SessionRosterProjection {
    /// The one age slot's reading (`cockpit-roster-turn-clock.md`): which of the three the row
    /// draws, and the moment a ticking one counts from.
    enum Clock: Equatable, Sendable {
        /// A Turn Argo owns the start of — DIRECT. Drawn as a live duration, `4m 12s`.
        case turn(startedAtMs: Int)
        /// An observed Session mid-turn — DERIVED. Argo only ever saw the last record land, so
        /// this is worded `output … ago` and never as a duration a quiet gap would falsify.
        case output(sinceMs: Int)
        /// The seen reading every other row keeps, already worded (`2m ago`).
        case seen(String)
    }

    /// One slot, three readings, degrade-down: a managed running Session whose Turn start the
    /// records do not stamp takes the seen reading, never a guess — and an observed one never
    /// takes a duration at all.
    ///
    /// The stream is passed IN rather than reached for: the row's other reading walks the same
    /// tail (`activity(of:in:)`), and the count that gates the selection pass is of stream
    /// hand-outs (`PerfBudgets.selectionPassReads`), so a second reach would cost a read whether
    /// or not the walk behind it is bounded.
    static func clock(
        for session: CockpitPresentation.Session, in events: [TranscriptEvent], nowMs: Int,
    )
        -> Clock? {
        if session.status == .running, let live = liveReading(session, in: events) {
            return live
        }
        return session.lastSeenAtMs.map { .seen(AgePhrase.phrase(sinceMs: $0, nowMs: nowMs)) }
    }

    /// A `switch` and not an access test, so a posture added to this axis has to answer which
    /// reading its Turn has earned.
    private static func liveReading(
        _ session: CockpitPresentation.Session, in events: [TranscriptEvent],
    )
        -> Clock? {
        switch session.access {
        case .managed:
            openTurnStartMs(events).map { .turn(startedAtMs: $0) }
        case .external, .orphaned:
            session.lastSeenAtMs.map { .output(sinceMs: $0) }
        }
    }

    /// The clock as words, fixed at projection time: the drawn reading ticks in the view, and a
    /// projection pass is how the spoken one keeps up — exactly as the seen age always has.
    static func spokenClock(_ clock: Clock?, nowMs: Int) -> String? {
        switch clock {
        case let .turn(startedAtMs):
            "running for \(spokenSince(startedAtMs, nowMs: nowMs))"
        case let .output(sinceMs):
            "last output \(spokenSince(sinceMs, nowMs: nowMs)) ago"
        case let .seen(phrase):
            "last active \(phrase)"
        case nil:
            nil
        }
    }

    private static func spokenSince(_ sinceMs: Int, nowMs: Int) -> String {
        TurnClockPhrase.spoken(seconds: TurnClockPhrase.seconds(sinceMs: sinceMs, nowMs: nowMs))
    }

    /// The open Turn's start: the FIRST prompt after the last Turn boundary. A steer typed
    /// mid-turn arrives as another prompt into the same sequence and must not restart the clock.
    ///
    /// `queued` is ignored on purpose: whether a Turn is actually open is the status's claim
    /// (`SessionStatus.read`), and this scan is consulted only once it says `running`.
    ///
    /// **Backwards, and it stops at the boundary** (ADR-0028 Rule 1). The answer is a fact about
    /// the OPEN Turn, so reading it cost a walk of every Turn that had already ended — once per
    /// running Session, on every pass of the shell's body, including the one between a click and
    /// the frame it asks for. Walking back, the last `turnEnded` is where the open Turn begins and
    /// there is nothing behind it worth reading; `start` is overwritten by each earlier prompt, so
    /// what survives to the boundary is the first prompt of the Turn — the same answer the forward
    /// walk built with a flag.
    private static func openTurnStartMs(_ events: [TranscriptEvent]) -> Int? {
        var start: Int?
        for event in events.reversed() {
            switch event {
            case let .prompt(_, _, atMs):
                start = atMs
            // A Turn nobody typed starts where the report that woke it landed (#1299) — the only
            // record a fan-out's next Turn has. Overwritten by an earlier prompt like any other
            // start, so a run that was woken and then steered still clocks from the steer.
            case let .turnResumed(atMs):
                start = atMs
            // An interrupt is a boundary like any other, and the commoner one on a Session
            // somebody is watching: the walk stops at it (#1189).
            case .turnEnded, .interrupted:
                return start
            default:
                break
            }
        }
        return start
    }
}
