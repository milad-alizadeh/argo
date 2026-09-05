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
        var handedOver: [String: ToolCall] = [:]
        var endings: [Int: FeedRow.Content] = [:]
        // FORWARDS, gathering the handovers as it goes, so an outcome is only ever answered by a
        // call the record wrote ABOVE it. A pre-pass over the whole stream would let a host that
        // reuses a call id label an early ending with a later delegation's brief — which is the
        // one thing the row exists to get right.
        for (position, event) in events.enumerated() {
            switch event {
            case let .toolCall(call) where call.kind == .delegate:
                handedOver[call.id] = call
            case let .toolCallOutcome(outcome):
                guard let call = handedOver[outcome.id],
                      let end = FeedCallReading.call(call, outcome: outcome, within: path)
                      .flatMap(FeedDelegationEnd.init)
                else { continue }
                endings[position] = .delegationEnded(end)
            default: continue
            }
        }
        return endings
    }
}
