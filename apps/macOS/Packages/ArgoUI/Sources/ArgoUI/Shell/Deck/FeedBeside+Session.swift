import ArgoEngine

/// The facts the feed reads that are NOT the record's, taken off a Session (#1504).
///
/// Beside `SessionsRoomReadingCache.Stamp` rather than inside it: the derivation belongs with the
/// value it makes, and the memo key only has to say that it holds one.
extension FeedBeside {
    init(
        of session: CockpitPresentation.Session?,
        asking: FeedAskProjection.Asking,
        handedOff: FeedHandoff?,
    ) {
        self.init(
            turn: FeedTurnDriven(
                working: FeedWorking.isWorking(session?.status),
                // Nothing while Argo is handing off (#1229): the Turn in flight is then the
                // `/handoff` prompt Argo itself steered, and a prompt row would draw a line of
                // Argo's own words — the brief's absolute path and all — as something the
                // reader typed and is waiting on. The plinth over this reading stands for it.
                submitted: (session?.handingOff ?? false) ? nil : session?.submittedTurn,
            ),
            waits: FeedWaitsHeld(
                startedQuietly: session?.startedQuietlyAtMs != nil,
                settled: session?.settledWaits ?? [],
            ),
            handoffs: FeedHandoffs(
                landed: handedOff,
                failed: session?.handoffFailures ?? [],
            ),
            gate: FeedGateHolds(
                asking: asking,
                reported: session?.companionAsk?.ask,
                expired: session?.expiredPermissions ?? [],
            ),
        )
    }
}
