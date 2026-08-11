import ArgoEngine

/// A run of calls that did the same thing to the same subject, read as one line. CONSECUTIVE only:
/// fusing two edits with other work between them would make one line stand for two moments.
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
    /// Whether another call is the same work on the same subject. A DELEGATION never stands for
    /// another: each subagent has its own ending and spend, so a collapsed run would report
    /// finished when only the last of them had.
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
    /// How a run of calls ended. A failure anywhere in it wins, and a run still waiting on one of
    /// its calls has not succeeded yet either.
    func overtaken(by next: FeedCall.Ending) -> FeedCall.Ending {
        if self == .failed || next == .failed {
            return .failed
        }
        return self == .pending || next == .pending ? .pending : .succeeded
    }
}
