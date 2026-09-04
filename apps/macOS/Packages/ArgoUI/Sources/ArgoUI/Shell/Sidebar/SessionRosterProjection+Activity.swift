import ArgoEngine

/// What a roster row says the Session is doing at this second (#1199) — the newest call in its
/// record, in the words the feed already uses for it.
extension SessionRosterProjection {
    /// `Ran bun run quality`, `Edited SessionRow.swift`, `Invoked EnterWorktree`. One line: the
    /// verb the feed spends on the call's kind, and the subject as the feed draws it.
    ///
    /// **Only while the Session is `running`**, and `nil` everywhere else. A call from ten minutes
    /// ago drawn as if it were live is the false DIRECT `CONTEXT.md` degrade-down forbids, so every
    /// other status keeps the fact the slot already carries — and so does a running Session that
    /// has emitted no call yet, which draws that fact rather than a blank.
    /// The stream is passed IN, for the reason `clock(for:in:nowMs:)` takes it: the two readings
    /// walk the same tail, and the count that gates the selection pass is of stream hand-outs
    /// (`PerfBudgets.selectionPassReads`) rather than of the walking.
    static func activity(
        of session: CockpitPresentation.Session, in events: [TranscriptEvent],
    )
        -> String? {
        guard session.status == .running else { return nil }
        // The Session's own location and not a walk for the record's last `cwd`: the two are the
        // same fact (`CockpitPresentation+Hub`), and one of them is already in hand.
        let path = FeedPath(cwd: session.workspaceLocation)
        return newestCall(in: events, within: path)
            .map { "\($0.kind.verb) \($0.subject.drawn)" }
    }

    /// **Backwards, and it stops at the OPEN Turn's boundary** (ADR-0028 Rule 1), the way
    /// `openTurnStartMs` does. Two things ride on that bound and neither is the arithmetic:
    ///
    /// A call before the last `turnEnded` belongs to a Turn that finished, and drawing it while
    /// the next one runs is the same stale reading the `running` guard above exists to refuse —
    /// so the Turn boundary is where the honest answer stops, not merely where the cheap one does.
    /// With it, the walk cannot read past the newest Turn however long the record is; without it,
    /// a running Session that had made no call would walk the whole stream on every body pass.
    ///
    /// The outcomes are gathered on the way down, which is where a call's own answer always is:
    /// the two events are written by different records, so the result is read through the call's
    /// id rather than by position (`FeedProjection.outcomes`).
    private static func newestCall(
        in events: [TranscriptEvent], within path: FeedPath,
    )
        -> FeedCall? {
        var answered: [String: ToolCallOutcome] = [:]
        for event in events.reversed() {
            switch event {
            case let .toolCallOutcome(outcome):
                answered[outcome.id] = outcome
            // A call carrying a question is not a call row in the feed but an ask
            // (`FeedProjection`), so it is not this slot's news either. The plan tool is the
            // second such call, and reads as none at all — its writes are standing state with a
            // surface of their own. Both leave the walk to carry on to the call before them
            // rather than emptying the slot on a Session that is plainly working.
            case let .toolCall(call) where call.ask == nil:
                if let read = FeedCallReading.call(
                    call, outcome: answered[call.id], within: path,
                ) {
                    return read
                }
            // An interrupt ends a Turn like any other boundary, and is the commoner one on a
            // Session somebody is watching (#1189).
            case .turnEnded, .interrupted:
                return nil
            default:
                break
            }
        }
        return nil
    }
}
