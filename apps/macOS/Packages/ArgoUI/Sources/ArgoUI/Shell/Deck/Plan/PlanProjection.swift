import ArgoEngine

/// The transcript stream, as the one plan standing at the end of it.
///
/// A sibling of `FeedProjection` over the same events, deliberately not a part of it. The two read
/// the stream for different KINDS of thing: the feed reads it as a sequence of moments and turns
/// each into a row, and this reads it as a single fact that the newest mention replaces. A plan
/// folded into the row list would have to be filtered back out of it by every surface that draws
/// one, and the feed's rule — a row per event, in the record's order — is exactly what the plan is
/// not.
enum PlanProjection {
    /// The plan in force, or `nil` when the Session has none.
    ///
    /// The LAST `.plan` the record carries and nothing else: the agent delivers the complete list
    /// each time (ADR-0020), so the newest is the whole of it. Everything the acceptance criteria
    /// ask for falls out of that one sentence — replacement is the newest winning, carry-over is a
    /// turn with no `.plan` in it leaving the last one standing, and absence is a record with none.
    static func reading(from events: [TranscriptEvent]) -> PlanReading? {
        // `lazy`, so a long transcript stops at the newest plan rather than collecting every one
        // of them to keep the first.
        let entries = events.reversed().lazy.compactMap { event -> [PlanEntry]? in
            guard case let .plan(plan) = event else { return nil }
            return plan.entries
        }.first

        // An emptied list is treated as no plan rather than as a plan of nothing. A pill reading
        // `0 steps` is chrome standing for a fact with no content, and the honest rendering of a
        // list with nothing on it is the same as the honest rendering of a Session that never
        // wrote one — nothing at all.
        guard let entries, !entries.isEmpty else { return nil }

        return PlanReading(entries: entries)
    }
}

extension PlanProjection {
    /// The preview transcript's plan — the one place every specimen and `#Preview` takes the pill's
    /// reading from, so none of them can be looking at a different list.
    static let previewReading = reading(from: CockpitPresentation.Session.previewTranscript)
}
