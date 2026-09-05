import ArgoEngine

/// What a Subagent's OWN record says about how long it ran and what it spent (#1279).
///
/// A backgrounded delegation reports neither figure at either end (#908): the launch receipt
/// carries no `usage` and no duration, and the late report states a token TOTAL in a shape
/// `TranscriptReader+Report.swift` refuses on purpose. So a finished background chip drew nothing
/// under its name. Argo holds that child's own file anyway (#858), and both figures are in it.
///
/// **DERIVED, and never the reported total's equal.** A synchronous agent's host-measured pair is
/// what the host itself observed of the run; this is what Argo can see of the child's record. Where
/// both exist the reported one wins, which is `FeedAgents.told(_:by:at:)`'s ruling rather than this
/// value's — this only ever states what the reading holds.
///
/// **Degrade down.** Every figure here is optional and a reading with nothing in it measures
/// nothing. An empty meter is the honest state for a child Argo has not read; a `0` would claim the
/// work took no time and cost nothing.
struct SubagentMeasure: Equatable, Sendable {
    /// The earliest moment the child's own records report, and what a running chip counts up from
    /// where the delegating call was never dated.
    let firstAtMs: Int?
    /// The latest moment they report.
    let lastAtMs: Int?
    /// The roll-up of every spend the child's records reported, or `nil` where they reported none.
    /// `nil` and never a zero `Usage`: a record priced at nothing and a record nothing priced are
    /// two different claims, and only the first is a figure.
    let usage: Usage?

    /// Nothing measured — the reading Argo does not have.
    static let unmeasured = SubagentMeasure(firstAtMs: nil, lastAtMs: nil, usage: nil)

    /// How long the record SPANS, where it spans anything.
    ///
    /// Two DISTINCT moments are required. One dated record gives a span of zero, and a `0s` beside
    /// a name is a measurement rather than the absence of one — the same untruth as a `0` spend,
    /// written in the other unit.
    var durationMs: Int? {
        guard let firstAtMs, let lastAtMs, lastAtMs > firstAtMs else { return nil }
        return lastAtMs - firstAtMs
    }

    /// ONE walk of one child's reading, folding both figures at once (#858's rule, one level down).
    ///
    /// Every event that carries a moment is read, not the prompts alone: a Subagent's file opens
    /// with the brief it was handed and then dates its work through the calls it makes and the
    /// results that come back, so a first-and-last taken off prompts would measure the handover
    /// against itself.
    ///
    /// The spend is `billedTokens` arithmetic on a ROLL-UP — every assistant record is priced on
    /// its own, and the sum is what the run cost. `UsageReading.unreadable` adds nothing: an object
    /// this reader could name no term in is not a spend of zero.
    static func read(_ events: [TranscriptEvent]) -> SubagentMeasure {
        var firstAtMs: Int?
        var lastAtMs: Int?
        var usage: Usage?
        for event in events {
            if let atMs = moment(of: event) {
                firstAtMs = min(firstAtMs ?? atMs, atMs)
                lastAtMs = max(lastAtMs ?? atMs, atMs)
            }
            if case let .usage(reading) = event, let spent = reading.usage {
                usage = usage.map { $0 + spent } ?? spent
            }
        }
        return SubagentMeasure(firstAtMs: firstAtMs, lastAtMs: lastAtMs, usage: usage)
    }

    /// The moment one event carries, or `nil` for one that carries none. A call's own two moments
    /// arrive as two events — emitted, and answered — so each is read where it is written.
    private static func moment(of event: TranscriptEvent) -> Int? {
        switch event {
        case let .prompt(_, _, atMs): atMs
        case let .turnResumed(atMs): atMs
        case let .interrupted(atMs): atMs
        case let .compaction(atMs): atMs
        case let .toolCall(call): call.atMs
        case let .toolCallOutcome(outcome): outcome.endedAtMs
        default: nil
        }
    }
}
