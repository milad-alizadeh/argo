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
    /// channel it arrived over is still there to stand behind it (`HubSession.reported`) and the
    /// report still stands behind the WORD (`holds(_:)`, #1409). Then a
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
        if let reported = reported?.status, holds(reported) {
            return SessionStatusReading(tier: .convention, status: reported)
        }
        // Below every channel above it, because a channel that has SPOKEN is itself proof the CLI
        // is up — and above the record, which has no word for a Session that has written none.
        if startup == .awaitingFirstOutput {
            return SessionStatusReading(tier: .direct, status: .starting)
        }
        // Below `starting` and not above it, though this is the louder word: a CLI Argo has heard
        // nothing at all from cannot be shown to have heard a Turn either, and ambiguity resolves
        // to the quieter of the two claims (#1048).
        //
        // Gated on the WHOLE wait rather than on the `starting` half of it: a spawn past its limit
        // has still never been heard, so a Turn typed at it after the row went quiet would report
        // `running` at DIRECT over a process that has never printed a byte (#1245).
        if !startup.heardNothing, submittedTurn?.isAwaitingRecord(events.count) == true {
            return SessionStatusReading(tier: .direct, status: .running)
        }
        // Below every channel above it and above the record's own fold: the reader ending a
        // delegation is Argo's own gesture, so it is DIRECT — but a CLI that has SPOKEN since
        // outranks a decision taken about the silence before it.
        //
        // `idle` and never `ended`: the process is up, its prompt is free, and the reader is about
        // to type at it. What this takes away is the `running` a lost report left standing (#1267),
        // and nothing more.
        // The gesture is asked about FIRST: a Session nobody has ended a delegation on takes no
        // walk on THIS road. It still pays for one on the projection's, which reads the hold for
        // every row on every publish — the same order as the roster's own delegation walk, and
        // about a thirtieth of what building the rows would cost (#1394).
        if !endedDelegations.isEmpty, delegationHold.isEnded {
            return SessionStatusReading(tier: .direct, status: .idle)
        }
        return SessionStatus.read(signals)
    }

    /// Whether a status the agent REPORTED is still one the report itself stands behind (#1409).
    ///
    /// One word is gated, and only one. `asking` is the single reported status that names something
    /// the reader is meant to ACT on, and the thing to act on is the question beside it — so a
    /// report claiming `asking` while carrying no `pendingAsk` is telling the reader to answer
    /// something no surface can show them. `CompanionReport.answered` already refuses that pair
    /// where an answer arrives (#1205); this refuses it where none ever can, because the agent
    /// reported the word off `report_status` alone and raised no question to answer.
    ///
    /// Nothing here expires and nothing is timed: the claim is read against the report's OWN other
    /// fact, at the moment it is read, so an agent that raises its question a moment later reads
    /// `asking` from that moment on. Degrade-down (ADR-0008) is what settles the gap — the quieter
    /// reading below stands while the louder one has nothing behind it.
    ///
    /// Every other word is a claim about what the agent is DOING, which needs no second fact to be
    /// about something, so none of them is gated.
    private func holds(_ reported: SessionStatus) -> Bool {
        reported != .asking || companionAsk != nil
    }

    /// What a backgrounded delegation is holding open here (#1267) — see `DelegationHold`, which
    /// owns the whole reading. `none` for the Sessions that have delegated nothing, which is most.
    ///
    /// DERIVED, off the record alone. Public because the composer reads it: a Turn held open by a
    /// child that has already been handed off is not a Turn a follow-up must queue behind, and the
    /// status word cannot say which of its reasons it was read from.
    var delegationHold: DelegationHold {
        DelegationHold.read(events, ended: endedDelegations)
    }

    /// The Turn Argo has typed that nothing has answered yet (#1179, #1278), verbatim — the
    /// DIRECT half of "is a Turn running", and a stronger answer than the status word wherever the
    /// two disagree.
    ///
    /// The same claim `statusReading` reads `running` off, asked separately because the status word
    /// can be overruled above it: a drive port or a companion that reports `idle` wins the status,
    /// and Argo's own submit is still the firmer news. What the composer needs is that news alone,
    /// not the word it usually produces — and the WORDS with it, because the feed draws them the
    /// frame they are sent rather than waiting for a record to hold them.
    ///
    /// It answers ONLY about a Turn Argo itself typed. An open Turn the record carries is
    /// deliberately not in here: `SessionTurnState.merge` carries a root's open Turn across a
    /// resume (ADR-0026), so a Session whose CLI died mid-Turn reads one open forever — and a
    /// composer that held its queue against that would never release it.
    ///
    /// Words rather than a flag, and one reading rather than two: whether there IS such a Turn is
    /// `nil`-ness, and a second stored answer beside it is how a feed comes to draw a Turn the
    /// composer has already released.
    var unansweredTurn: String? {
        guard let submittedTurn, submittedTurn.isAwaitingRecord(events.count) else { return nil }
        return submittedTurn.text
    }

    var status: SessionStatus {
        statusReading.status
    }
}
