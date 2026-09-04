import ArgoDesign

/// A Turn's work, read as one line.
///
/// Every loud call a Turn made, of the kinds that belong together, folded into one row: `Ran 8`,
/// `Edited 36 · Created 2`. A fold and never a filter — the count is what the Turn did, and every
/// call is still one click behind the line.
///
/// Per TURN and not per RUN, which is what makes it worth twice what an adjacency rule is worth
/// (#1172): an agent narrates its own work, so thirty-six edits in one Turn are separated by the
/// sentences that explain them and never sit next to each other.
package struct FeedWork: Equatable, Sendable, FeedFolded {
    package let calls: [FeedCall]

    /// One mark for the whole stretch and not one per kind — the line already names the kinds.
    package var symbol: String {
        ArgoSymbol.worked
    }

    /// How many of the folded rows failed. Counted in ROWS and not in calls, unlike the label
    /// above: a collapsed run of three shares one ending, so the record no longer says which of
    /// them broke and `3 failed` would claim two failures nobody reported.
    package var failures: Int {
        calls.count(where: \.ending.hasFailed)
    }

    /// What the whole stretch did in lines, where any of it carried a patch to count. `nil` for a
    /// card of commands, and for one whose edits all came back with an unreadable patch — a
    /// diffstat reading `+0 −0` claims the work changed nothing.
    package var churn: FeedCall.Churn? {
        let churn = calls.compactMap(\.churn).reduce(FeedCall.Churn(added: 0, removed: 0)) {
            FeedCall.Churn(added: $0.added + $1.added, removed: $0.removed + $1.removed)
        }
        return churn.isSilent ? nil : churn
    }

    /// The word the counts stand for. Never drawn on the line — the counts carry their own verbs —
    /// but spoken by the panel this row opens.
    static let verb = "Worked on"

    /// The whole line as one sentence, for a reader who cannot see it. The failure count comes back
    /// in words, because it is drawn in the failure ink and a colour says nothing in the ear.
    package var spoken: String {
        [label, spokenFailures, ending.spoken].compactMap(\.self).joined(separator: " ")
    }

    private var spokenFailures: String? {
        failures > 0 ? "\(failures) failed" : nil
    }

    /// What the panel shows for this line: every result the stretch produced, each addressed by the
    /// call that produced it.
    package var opened: FeedEvidence {
        FeedEvidence(
            verb: Self.verb,
            symbol: symbol,
            label: label,
            ending: ending,
            steps: FeedFold.steps(of: calls),
        )
    }
}

extension FeedCall {
    /// Which stretch of a Turn's work this call joins, or `nil` for a call that never folds.
    ///
    /// The grouping is kind-AGNOSTIC inside a stretch and the caption is kind-aware, which is what
    /// reconciles the measured win with legibility (#1172): an `Edit` next to a `Write` is one
    /// piece of the Turn's work, and the line still says `Edited 3 · Created 1`.
    ///
    /// Three kinds fold into nothing. Looking is the survey's, whose adjacency rule ran first and
    /// left behind only the reads that failed or came back holding a picture — a stretch those
    /// joined would read as a survey while obeying a different rule. A delegation is a whole other
    /// agent's Turn and carries the rail's join key on its own row, which a count would take away.
    var stretch: FeedWork.Stretch? {
        switch kind {
        case .execute: .commands
        case .edit, .create, .delete, .move: .files
        case .skill, .fetch, .mcp, .unclassified: .tools
        case .read, .search, .delegate: nil
        }
    }
}

extension FeedWork {
    /// The stretches a Turn's work falls into. One card per stretch per Turn, which measured at a
    /// 46% median row cut over nine real transcripts against 28% for folding runs of adjacent
    /// calls (#1172).
    enum Stretch: Equatable, Sendable {
        /// What ran on the machine.
        case commands
        /// What the tree came out of it changed.
        case files
        /// Everything the agent reached for that is neither — a skill, a fetch, an MCP tool, and a
        /// tool this CLI did not classify.
        case tools
    }
}
