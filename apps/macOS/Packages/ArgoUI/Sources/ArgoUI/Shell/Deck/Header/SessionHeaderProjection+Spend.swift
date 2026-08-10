import ArgoEngine

/// What the Session has spent and how long it has been going — the whole life of the Session, as
/// against the context reading, which is only what it is holding right now.
///
/// The composition is the rule: the line is built from the facts that are PRESENT, so a fact
/// nothing reported disappears from it rather than rendering as a zero. Every CLI in use today
/// reports nothing for subagent spend, and `0 subagents` would claim none ran — which is the one
/// thing on this line the reader would act on.
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

    /// A Session every one of whose gaps was too long worked NONE of the time it ran, and that is
    /// the fact worth reading — `worked under a minute` would spell a Session left alone all day
    /// exactly like one that has just started.
    private static func worked(for milliseconds: Int) -> String {
        guard milliseconds > 0 else { return "worked none of it" }
        return "worked \(ElapsedTime.phrase(milliseconds: milliseconds))"
    }

    /// Wall-clock: the transcript's first record to its last, which is what the Session has
    /// spanned.
    ///
    /// Both ends or nothing. One moment is not a duration, and taking the clock for the other end
    /// would report a Session that stopped last Tuesday as still going.
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

    /// Every moment the transcript can be said to have done something at, in order.
    ///
    /// Sorted rather than trusted: a resume chain is stitched from more than one file, and the
    /// gaps are only gaps if the moments they run between are the ones either side of them.
    private static func moments(in events: [TranscriptEvent]) -> [Int] {
        events.compactMap { event in
            switch event {
            case let .prompt(_, atMs): atMs
            case let .toolCall(call): call.atMs
            case let .toolCallOutcome(outcome): outcome.endedAtMs
            case let .compaction(atMs): atMs
            case .recordIdentity, .headLeaf, .title, .cwd, .model, .branch, .message, .thought,
                 .turnEnded, .usage, .plan, .queued, .unreadableLine: nil
            }
        }
        .sorted()
    }
}
