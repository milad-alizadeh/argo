import ArgoEngine

// The end of a delegation, as the projection reads it (#1281). Its own file for
// `FeedProjection+RunFacts`'s reason: the walk in `FeedProjection` is at its length, and this is
// one question asked of one event kind.

extension FeedProjection {
    /// The ending each delegation's ANSWER lands, by the position in the stream it landed at — so
    /// the walk drops the row where the record closed the delegation and nowhere else.
    ///
    /// Read off the ONE outcome and not the call's resolved reading, which is what keeps a
    /// backgrounded handover honest: it is answered twice, by a launch receipt at once and a report
    /// later (#908), and only the second of those ends anything. `FeedDelegationEnd` refuses a
    /// reading that is still pending, so the receipt writes no row and the report writes one.
    ///
    /// A delegation nothing ever closes is never in here, which is the point: Argo does not invent
    /// an ending it cannot see (#1076, #1090).
    static func delegationEndings(in events: [TranscriptEvent], within path: FeedPath)
        -> [Int: FeedRow.Content] {
        let handedOver = delegations(in: events)
        return events.enumerated().reduce(into: [:]) { endings, pair in
            guard case let .toolCallOutcome(outcome) = pair.element,
                  let call = handedOver[outcome.id],
                  let end = FeedCallReading.call(call, outcome: outcome, within: path)
                  .flatMap(FeedDelegationEnd.init)
            else { return }
            endings[pair.offset] = .delegationEnded(end)
        }
    }

    /// The delegating calls in the stream, by the id their result quotes. Gathered ahead of the
    /// pass rather than beside it because nothing else needs them in order: the answer is asked by
    /// id, and the record always writes an outcome after the call it answers.
    private static func delegations(in events: [TranscriptEvent]) -> [String: ToolCall] {
        events.reduce(into: [:]) { found, event in
            guard case let .toolCall(call) = event, call.kind == .delegate else { return }
            found[call.id] = call
        }
    }
}
