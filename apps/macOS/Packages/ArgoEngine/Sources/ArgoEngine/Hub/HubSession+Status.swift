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
    /// on. Below those, a status the agent REPORTED wins at the CONVENTION tier, for as long as the
    /// channel it arrived over is still there to stand behind it (`HubSession.reported`). Then a
    /// CLI Argo is
    /// still waiting on, at DIRECT on the same ground — the PTY those bytes have not come out of is
    /// Argo's own. Then a Turn Argo TYPED at that PTY, DIRECT on the same ground again and until
    /// the record answers it (#1048). A Session with no channel, or one that has said nothing,
    /// falls through to DERIVED, never worse.
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
        if let reported = reported?.status {
            return SessionStatusReading(tier: .convention, status: reported)
        }
        // Below every channel above it, because a channel that has SPOKEN is itself proof the CLI
        // is up — and above the record, which has no word for a Session that has written none.
        if awaitingFirstOutput {
            return SessionStatusReading(tier: .direct, status: .starting)
        }
        // Below `starting` and not above it, though this is the louder word: a CLI Argo has heard
        // nothing at all from cannot be shown to have heard a Turn either, and ambiguity resolves
        // to the quieter of the two claims (#1048).
        if submittedTurn?.isAwaitingRecord(events.count) == true {
            return SessionStatusReading(tier: .direct, status: .running)
        }
        return SessionStatus.read(signals)
    }

    var status: SessionStatus {
        statusReading.status
    }
}
