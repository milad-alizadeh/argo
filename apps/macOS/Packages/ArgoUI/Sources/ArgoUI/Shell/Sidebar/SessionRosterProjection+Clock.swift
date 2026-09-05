import ArgoEngine

extension SessionRosterProjection {
    /// The one age slot's reading (`cockpit-roster-turn-clock.md`): which of the three the row
    /// draws, and the moment a ticking one counts from.
    enum Clock: Equatable, Sendable {
        /// A Session Argo owns the start of — DIRECT. Drawn as a live duration, `4m 12s`, counted
        /// from the resume-chain's first prompt and unbroken by Turn boundaries (#1330).
        case turn(startedAtMs: Int)
        /// An observed Session mid-turn — DERIVED. Argo only ever saw the last record land, so
        /// this is worded `output … ago` and never as a duration a quiet gap would falsify.
        case output(sinceMs: Int)
        /// The seen reading every other row keeps, already worded (`2m ago`).
        case seen(String)
    }

    /// One slot, three readings, degrade-down: a managed running Session whose start the
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
            sessionStartMs(events).map { .turn(startedAtMs: $0) }
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

    /// The Session's own start: the FIRST prompt of the resume-chain, full stop — never a later
    /// one, and never reset by a Turn boundary in between (#1330). A steer typed mid-turn is
    /// another prompt into the same sequence and does not restart it, and neither does a
    /// `turnEnded` / `turnResumed` pair moving the Session from one Turn into the next: the
    /// total the row draws covers the gap between them the same as the work either side of it —
    /// the simpler rule, and the one the design's picture asks for.
    ///
    /// `queued` is ignored on purpose: whether the Session is actually running is the status's
    /// claim (`SessionStatus.read`), and this scan is consulted only once it says `running`.
    ///
    /// Forward, and it takes the FIRST match, stamped or not. A `.prompt` with no stamp degrades
    /// the whole reading to the seen phrase (`clock(for:in:nowMs:)` falls back once this returns
    /// `nil`) rather than let a later, stamped prompt stand in for the one Argo cannot vouch for.
    private static func sessionStartMs(_ events: [TranscriptEvent]) -> Int? {
        for event in events {
            switch event {
            case let .prompt(_, _, atMs):
                return atMs
            // A Turn nobody typed starts where the report that woke it landed (#1299); the
            // resume-chain's first record can be one of these when it began headless.
            case let .turnResumed(atMs):
                return atMs
            default:
                continue
            }
        }
        return nil
    }
}
