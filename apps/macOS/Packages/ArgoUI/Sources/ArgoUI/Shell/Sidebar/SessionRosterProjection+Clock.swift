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
    static func clock(
        for session: CockpitPresentation.Session, nowMs: Int,
    )
        -> Clock? {
        if session.status == .running, let live = liveReading(session) {
            return live
        }
        return session.lastSeenAtMs.map { .seen(AgePhrase.phrase(sinceMs: $0, nowMs: nowMs)) }
    }

    /// A `switch` and not an access test, so a posture added to this axis has to answer which
    /// reading its Turn has earned.
    private static func liveReading(_ session: CockpitPresentation.Session) -> Clock? {
        switch session.access {
        case .managed:
            openTurnStartMs(session.events).map { .turn(startedAtMs: $0) }
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
    private static func openTurnStartMs(_ events: [TranscriptEvent]) -> Int? {
        var start: Int?
        var isOpen = false
        for event in events {
            switch event {
            case let .prompt(_, _, atMs):
                guard !isOpen else { break }
                isOpen = true
                start = atMs
            case .turnEnded:
                isOpen = false
                start = nil
            default:
                break
            }
        }
        return start
    }
}
