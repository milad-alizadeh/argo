import ArgoEngine

/// Who else is working, read off the feed the reader is already looking at.
///
/// ONE reading, not two: the rail's visibility and the chips in it are the same claim about the
/// same rows, so a count cannot disagree with the list it counts.
enum FeedAgents {
    /// Every subagent the reading knows about, in the order the work was handed over.
    ///
    /// One row is one child, and that holds because a delegation is never collapsed into another
    /// (`FeedCall.stands(for:)`): two agents handed the same brief keep two rows, two endings and
    /// two spends.
    static func all(in rows: [FeedRow]) -> [FeedAgent] {
        rows.compactMap(delegation(in:)).enumerated().map { position, call in
            FeedAgent(
                id: position,
                // The disambiguated address: a row here stands alone in a column of its own, with
                // no line beside it to tell two same-named subjects apart.
                label: call.subject.captioned,
                isRunning: call.ending == .pending,
                spend: call.spend,
            )
        }
    }

    /// How many subagents are running right now, as far as the record can say.
    ///
    /// A delegation the transcript has not answered IS a subagent still working: the parent writes
    /// the call when it hands the work over and the result when it comes back. DERIVED, degrading
    /// the honest way — a transcript that stopped mid-turn leaves a delegation open forever, which
    /// reads as one running rather than as none.
    static func running(in rows: [FeedRow]) -> Int {
        all(in: rows).filter(\.isRunning).count
    }

    /// The delegation a row is, or `nil` — which is also what says the rail has nothing to show
    /// for it.
    private static func delegation(in row: FeedRow) -> FeedCall? {
        guard case let .call(call) = row.content, call.kind == .delegate else { return nil }
        return call
    }
}
