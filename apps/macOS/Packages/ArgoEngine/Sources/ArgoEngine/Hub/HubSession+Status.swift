public extension HubSession {
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
    ///
    /// A Permission Argo itself is holding open wins outright, at DIRECT: the agent is blocked on
    /// a hook whose both ends are Argo's, which outranks anything the agent said before it
    /// blocked. Below that, a status the agent REPORTED wins at the CONVENTION tier — the higher
    /// claim by construction, since the agent knows what it is doing where the transcript only
    /// shows what it has finished doing. A Session with no channel, or a channel that has said
    /// nothing, falls through to the DERIVED reading, never to a worse one.
    var statusReading: SessionStatusReading {
        if permission != nil {
            return SessionStatusReading(tier: .direct, status: .permission)
        }
        guard let reported = convention?.status else { return SessionStatus.read(signals) }
        return SessionStatusReading(tier: .convention, status: reported)
    }

    var status: SessionStatus {
        statusReading.status
    }
}
