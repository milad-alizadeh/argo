public extension HubSession {
    /// Everything the status is read from, assembled from what the transcript observed and what the
    /// Hub established about the process behind it.
    var signals: SessionSignals {
        SessionSignals(
            provenance: provenance,
            liveness: liveness,
            turnOpen: turn.isOpen,
            lastStop: turn.lastStop,
            // A question in a Turn that has since ended blocks nobody, and `SessionTurnState.ended`
            // has already dropped it — so a pending ask outside an open Turn cannot be represented.
            pendingAsk: turn.hasPendingAsk,
        )
    }

    /// The rollup and its tier, derived on read. Nothing about the status is stored: the Turn
    /// boundaries are what the transcript said, liveness is what the process table said a moment
    /// ago, and the status is only ever a reading of the two together.
    ///
    /// A Permission Argo itself is holding open wins outright, at DIRECT — both ends of that hook
    /// are Argo's. Then a status the CLI reported over the drive port, also DIRECT: the thread that
    /// reported it is one Argo started and holds the pipe to, so the join from the report to this
    /// Session is exact rather than the working directory and time window a transcript is matched
    /// on. Below those, a status the agent REPORTED wins at the CONVENTION tier. A Session with no
    /// channel, or one that has said nothing, falls through to DERIVED, never worse.
    var statusReading: SessionStatusReading {
        if permission != nil {
            return SessionStatusReading(tier: .direct, status: .permission)
        }
        // A question Argo itself is holding open wins on the same ground and at the same tier
        // (#712): both ends of that hook are Argo's, so the Session is asking as a fact rather than
        // as a reading of what the transcript last said.
        if ask != nil {
            return SessionStatusReading(tier: .direct, status: .asking)
        }
        if let driveStatus {
            return SessionStatusReading(tier: .direct, status: driveStatus)
        }
        guard let reported = convention?.status else { return SessionStatus.read(signals) }
        return SessionStatusReading(tier: .convention, status: reported)
    }

    var status: SessionStatus {
        statusReading.status
    }
}
