import ArgoEngine

/// What the Session has spent and how long it has been going — the whole life of it, as against the
/// context reading, which is only what it is holding right now.
///
/// The line is built from the facts that are PRESENT, so a fact nothing reported disappears rather
/// than rendering as a zero. Every CLI in use today reports nothing for subagent spend, and
/// `0 subagents` would claim none ran.
extension SessionHeaderProjection {
    enum SpendPolicy {
        /// Longer than this between two moments and nobody was at the keyboard: a gap that size is
        /// the user away, not an agent thinking. Measured across real transcripts, wall-clock and
        /// worked time differ by 5–8× on a long Session, which is the whole reason both are shown.
        static let awayGapMs = 5 * 60 * 1000
    }

    /// The composed line, and `nil` when there is nothing to compose it from — the line COLLAPSES
    /// rather than leaving the separators of facts it does not have.
    static func spend(from session: CockpitPresentation.Session) -> String? {
        let parts = [
            // Cache split off the spend, not summed into it: every request re-reads the whole
            // conversation from cache, so one figure would read tens of millions as fresh spend.
            session.spentTokens.map { "\(TokenCount.short($0)) tokens spent" },
            session.cachedTokens.map { "\(TokenCount.short($0)) cached" },
            // Said as a spend, not as a count: `4.1M subagents` reads as four million of them.
            session.subagentTokens.map { "\(TokenCount.short($0)) in subagents" },
            ran(from: session).map { "started \(ElapsedTime.phrase(milliseconds: $0)) ago" },
            worked(across: session.events).map(worked(for:)),
        ].compactMap(\.self)
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    private static func worked(for milliseconds: Int) -> String {
        "worked \(workedReading(milliseconds))"
    }

    /// A Session every one of whose gaps was too long worked NONE of the time it ran — `under a
    /// minute` would spell that exactly like a Session that has just started.
    static func workedReading(_ milliseconds: Int) -> String {
        milliseconds > 0 ? ElapsedTime.phrase(milliseconds: milliseconds) : "none of it"
    }

    /// Wall-clock: the transcript's first record to its last. Both ends or nothing — taking the
    /// clock for the other end would report a Session that stopped last Tuesday as still going.
    static func ran(from session: CockpitPresentation.Session) -> Int? {
        guard let started = session.startedAtMs, let last = session.lastSeenAtMs else { return nil }
        return max(last - started, 0)
    }

    /// Time with an agent actually working: the gaps below the cutoff, summed.
    ///
    /// `nil` where the record carries fewer than two moments — there is no gap to measure, and a
    /// zero would say a Session worked none of the time it ran. A real zero is reachable and does
    /// render: every gap above the cutoff is a Session that was left alone all day.
    static func worked(across events: [TranscriptEvent]) -> Int? {
        let moments = moments(in: events)
        guard moments.count > 1 else { return nil }
        return zip(moments, moments.dropFirst()).reduce(0) { worked, pair in
            let gap = pair.1 - pair.0
            return gap < SpendPolicy.awayGapMs ? worked + gap : worked
        }
    }

    /// Every moment the transcript can be said to have done something at, in order. Sorted rather
    /// than trusted: a resume chain is stitched from more than one file.
    private static func moments(in events: [TranscriptEvent]) -> [Int] {
        events.compactMap { event in
            switch event {
            case let .prompt(_, _, atMs): atMs
            case let .toolCall(call): call.atMs
            case let .toolCallOutcome(outcome): outcome.endedAtMs
            case let .compaction(atMs): atMs
            // A skill load carries no moment of its own: the CLI expands a body as part of the
            // prompt beside it, and that prompt's own timestamp is already counted.
            case .recordIdentity, .headLeaf, .originSession, .title, .cwd, .model, .branch, .mode,
                 .message, .thought, .turnEnded, .usage, .plan, .queued, .unreadableLine,
                 .skillLoaded: nil
            }
        }
        .sorted()
    }
}
