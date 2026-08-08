public extension HubSession {
    /// The host's own name for the structured question. Matched verbatim, because the tool name IS
    /// how the record distinguishes a question that blocks from one the agent merely typed out.
    static let askTool = "AskUserQuestion"

    /// Everything the status is read from, assembled from what the transcript observed and what the
    /// Hub established about the process behind it.
    var signals: SessionSignals {
        SessionSignals(
            provenance: provenance,
            liveness: liveness,
            turnOpen: turnOpen,
            lastStop: lastStop,
            // A question in a Turn that has since ended blocks nobody, and `apply` has already
            // dropped it — so a pending ask outside an open Turn is not representable here.
            pendingAsk: !pendingAsks.isEmpty,
        )
    }

    /// The rollup and its tier, derived on read. Nothing about the status is stored: the Turn
    /// boundaries are what the transcript said, liveness is what the process table said a moment
    /// ago, and the status is only ever a reading of the two together.
    var statusReading: SessionStatusReading {
        SessionStatus.read(signals)
    }

    var status: SessionStatus {
        statusReading.status
    }
}
