import ArgoEngine

/// The transcript stream, as the one plan standing at the end of it. A sibling of `FeedProjection`
/// over the same events: the feed reads a sequence of moments, this reads a single fact the newest
/// mention replaces.
enum PlanProjection {
    /// The plan in force, or `nil` when the Session has none. The LAST `.plan` the record carries
    /// and nothing else: the agent delivers the complete list each time (ADR-0020).
    static func reading(from events: [TranscriptEvent]) -> PlanReading? {
        // `lazy`, so a long transcript stops at the newest plan rather than collecting every one
        // of them to keep the first.
        let entries = events.reversed().lazy.compactMap { event -> [PlanEntry]? in
            guard case let .plan(plan) = event else { return nil }
            return plan.entries
        }.first

        // An emptied list is no plan, drawn exactly as a Session that never wrote one.
        guard let entries, !entries.isEmpty else { return nil }

        return PlanReading(entries: entries)
    }
}

extension PlanProjection {
    /// The preview transcript's plan — the one place every specimen and `#Preview` takes the pill's
    /// reading from, so none of them can be looking at a different list.
    static let previewReading = reading(from: TranscriptFixtures.previewTranscript)
}
