import ArgoEngine

extension SessionRosterProjection {
    /// The one age slot's reading (`cockpit-roster-turn-clock.md`): which of the three the row
    /// draws, and the moment a ticking one counts from.
    enum Clock: Equatable, Sendable {
        /// A Session Argo owns the start of — DIRECT. Drawn as a live duration, `4m 12s`, running
        /// from the resume-chain's first prompt and unbroken by any Turn boundary in between
        /// (#1330) — the reading is how long the Session has run, not how long its open Turn has.
        case session(startedAtMs: Int)
        /// An observed Session mid-turn — DERIVED. Argo only ever saw the last record land, so
        /// this is worded `output … ago` and never as a duration a quiet gap would falsify.
        case output(sinceMs: Int)
        /// The seen reading every other row keeps, already worded (`2m ago`).
        case seen(String)
    }

    /// One slot, three readings, degrade-down: a managed running Session whose start the records
    /// do not stamp takes the seen reading, never a guess — and an observed one never takes a
    /// duration at all.
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
    /// reading it has earned.
    private static func liveReading(
        _ session: CockpitPresentation.Session, in events: [TranscriptEvent],
    )
        -> Clock? {
        switch session.access {
        case .managed:
            sessionStartMs(events).map { .session(startedAtMs: $0) }
        case .external, .orphaned:
            session.lastSeenAtMs.map { .output(sinceMs: $0) }
        }
    }

    /// The clock as words, fixed at projection time: the drawn reading ticks in the view, and a
    /// projection pass is how the spoken one keeps up — exactly as the seen age always has.
    static func spokenClock(_ clock: Clock?, nowMs: Int) -> String? {
        switch clock {
        case let .session(startedAtMs):
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

    /// The Session's start: the FIRST prompt of the resume-chain, full stop. Unbroken by a Turn
    /// boundary — the reading is how long the SESSION has run, gaps between Turns included, not
    /// how long any one Turn has been open (#1330).
    ///
    /// `queued` is ignored on purpose: whether a Turn is actually open is the status's claim
    /// (`SessionStatus.read`), and this scan is consulted only once it says `running`.
    ///
    /// **Forward, and it stops at the first match** (ADR-0028 Rule 1). The answer is a fact about
    /// the WHOLE chain's earliest record, which sits near the head of `events` for exactly the
    /// Sessions this reading is asked of — a Session still running has not yet grown the long
    /// tail a finished one has. A wake nobody typed (`turnResumed`, #1299) only ever counts here
    /// when it is itself the chain's first record; once a prompt has been seen, nothing later
    /// overwrites it.
    private static func sessionStartMs(_ events: [TranscriptEvent]) -> Int? {
        for event in events {
            switch event {
            case let .prompt(_, _, atMs):
                return atMs
            case let .turnResumed(atMs):
                return atMs
            default:
                break
            }
        }
        return nil
    }

    /// The OPEN Turn's own start, kept apart from `sessionStartMs` on purpose: the dot's pulse
    /// paces off how fresh the CURRENT Turn is (#1291), which a Session running for hours across
    /// many Turns does not change on the second its newest one begins. The clock slot moved to
    /// the Session's whole age with #1330; this did not move with it.
    ///
    /// **Backwards, and it stops at the boundary** (ADR-0028 Rule 1) — unchanged from before
    /// #1330: the answer is a fact about the OPEN Turn, so reading it costs a walk of every Turn
    /// that had already ended once a boundary is hit, never further.
    static func openTurnStartedAtMs(
        for session: CockpitPresentation.Session, in events: [TranscriptEvent],
    )
        -> Int? {
        guard session.status == .running, session.access == .managed else { return nil }
        var start: Int?
        for event in events.reversed() {
            switch event {
            case let .prompt(_, _, atMs):
                start = atMs
            // A Turn nobody typed starts where the report that woke it landed (#1299), and is
            // overwritten by an earlier prompt like any other start.
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
