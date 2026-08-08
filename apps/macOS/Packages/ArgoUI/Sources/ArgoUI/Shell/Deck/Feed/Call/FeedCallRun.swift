import ArgoEngine

/// A run of calls that did the same thing to the same subject, read as one line.
///
/// Three edits of one file are one piece of work and three patches. Drawn as three rows they push
/// everything else off the screen and say nothing the first row did not; drawn as one row with the
/// patches behind it, the feed keeps its shape and the record keeps all three.
///
/// CONSECUTIVE runs only, and that is a hard limit rather than a first cut: fusing two edits that
/// had other work between them would put a line in the feed standing for two moments, and the one
/// thing the feed guarantees is that it shows what happened in the order it happened.
enum FeedCallRun {
    static func collapsed(_ contents: [FeedRow.Content]) -> [FeedRow.Content] {
        contents.reduce(into: []) { rows, content in
            guard case let .call(call) = content,
                  case let .call(previous) = rows.last,
                  previous.stands(for: call)
            else {
                rows.append(content)
                return
            }
            rows[rows.count - 1] = .call(previous.merged(with: call))
        }
    }
}

extension FeedCall {
    /// Whether another call is the same work on the same subject — the same verb AND the same
    /// thing named. A create followed by an edit of one file is two different claims and stays two
    /// rows; the destination a move carries is part of the verb here, for the same reason.
    ///
    /// A DELEGATION never stands for another, however alike the two look. Three edits of one file
    /// are one piece of work repeated; three subagents handed the same brief are three other
    /// agents, each with its own life, its own ending and its own spend — collapsed, one line would
    /// report a run that finished when only the last of them had, and the rail reading off it would
    /// show one agent's figure against every chip.
    func stands(for other: FeedCall) -> Bool {
        kind != .delegate && kind == other.kind && subject == other.subject
    }

    func merged(with next: FeedCall) -> FeedCall {
        FeedCall(
            kind: kind,
            subject: subject,
            churn: Churn.total(churn, next.churn),
            ending: ending.overtaken(by: next.ending),
            evidence: evidence + next.evidence,
            repeats: repeats + next.repeats,
            spend: Usage.total(spend, next.spend),
        )
    }
}

extension FeedCall.Churn {
    /// What a run of mutations did in lines, added up. Absent where nothing in the run carried a
    /// patch to count — a zero would claim the run changed nothing.
    static func total(_ first: FeedCall.Churn?, _ second: FeedCall.Churn?) -> FeedCall.Churn? {
        guard let first else { return second }
        guard let second else { return first }
        return FeedCall.Churn(
            added: first.added + second.added,
            removed: first.removed + second.removed,
        )
    }
}

extension FeedCall.Ending {
    /// How a run of calls ended.
    ///
    /// A failure anywhere in it wins: it happened, and a row reading green because the two edits
    /// after the failed one worked would hide the only thing on the line worth seeing. A run still
    /// waiting on one of its calls has not succeeded yet either.
    func overtaken(by next: FeedCall.Ending) -> FeedCall.Ending {
        if self == .failed || next == .failed {
            return .failed
        }
        return self == .pending || next == .pending ? .pending : .succeeded
    }
}
