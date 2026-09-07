import Foundation
import Observation

/// The claim-keyed half of what the Hub knows, under one key and one publish rule (#634).
///
/// Observed, because every fact here has to reach the roster in the update that established it: a
/// prompt in the update that raised it, a spawn's rung in the update that opened its PTY.
@MainActor
@Observable
final class ClaimLedger {
    private var byClaim: [SessionOwnership.ClaimID: ClaimFacts] = [:]
    /// Bumped by the one write below, which every publish here goes through — the roster's memo is
    /// keyed by it (`HubRosterMemo`), and a fact filed without moving it would be a fact the
    /// cockpit never draws.
    private(set) var revision = 0

    /// What is known about one claim, or nothing — including for a Session that has no claim at
    /// all, which is every external one.
    func facts(for claim: SessionOwnership.ClaimID?) -> ClaimFacts {
        claim.flatMap { byClaim[$0] } ?? ClaimFacts()
    }

    /// Fold one CONVENTION-tier report into what this claim's agent has already said.
    func record(_ fact: CompanionFact, for claim: SessionOwnership.ClaimID) {
        update(claim) { facts in
            var report = facts.report ?? CompanionReport()
            report.apply(fact)
            facts.report = report
        }
    }

    /// Where the channel that tier arrives over stands (#493). Its own publish, not part of the
    /// fold above: two tiers, two writes.
    func publish(companionLiveness: CompanionLiveness, for claim: SessionOwnership.ClaimID) {
        update(claim) { $0.companionLiveness = companionLiveness }
    }

    func publish(waiting: [PermissionRequest], for claim: SessionOwnership.ClaimID) {
        update(claim) { $0.waiting = waiting }
    }

    func publish(asking: [SessionAsk], for claim: SessionOwnership.ClaimID) {
        update(claim) { $0.asking = asking }
    }

    func publish(standing: [StandingAllow], for claim: SessionOwnership.ClaimID) {
        update(claim) { $0.standing = standing }
    }

    func publish(expired: [PermissionExpiry], for claim: SessionOwnership.ClaimID) {
        update(claim) { $0.expiries = expired }
    }

    /// All three of a gate's readings at once, in ONE update. A gate that published them separately
    /// would move the roster three times for a single act, and leave it briefly showing a prompt
    /// beside the expiry that ended it.
    func publish(_ readings: GateReadings, for claim: SessionOwnership.ClaimID) {
        update(claim) {
            $0.waiting = readings.waiting
            $0.standing = readings.standing
            $0.expiries = readings.expiries
        }
    }

    /// What the CLI itself said this Session is doing (#683), or `nil` to take it back when the
    /// process behind it goes.
    func publish(driveStatus: SessionStatus?, for claim: SessionOwnership.ClaimID) {
        update(claim) { $0.driveStatus = driveStatus }
    }

    /// The ticket this claim was started on (#872). Never taken back: what a Session was started
    /// for is something that happened, so an orphaned one is still the Session that took it.
    func setTicket(_ number: Int, for claim: SessionOwnership.ClaimID) {
        update(claim) { $0.ticket = number }
    }

    /// A wait Argo held at this claim, ended (#1323). Appended and never taken back, for the reason
    /// the ticket above is: the wait ran, and that stays true however the Session goes on.
    ///
    /// One entry per wait: a second ending for a wait already settled is dropped rather than
    /// appended, so a byte arriving twice cannot land the reader two rows saying one thing.
    func settle(_ settled: SessionWaitSettled, for claim: SessionOwnership.ClaimID) {
        update(claim) { facts in
            guard !facts.settledWaits.contains(where: { $0.wait == settled.wait }) else { return }
            facts.settledWaits.append(settled)
        }
    }

    /// Argo has started, or ended, running `/handoff` at this claim (#1327). Published on both
    /// edges: the plinth stands exactly as long as this reads `true`.
    func publish(handingOff: Bool, for claim: SessionOwnership.ClaimID) {
        update(claim) { $0.handingOff = handingOff }
    }

    /// The words Argo steered at this claim for a handoff (#1229), so a Turn reported lost can be
    /// told from one the reader typed while it ran.
    func setHandoffPrompt(_ text: String, for claim: SessionOwnership.ClaimID) {
        update(claim) { $0.handoffPrompt = text }
    }

    /// That steered Turn, never heard (#1229).
    ///
    /// It ends the submission in the same write, exactly as `setLostTurn` does and for the same
    /// reason: a Turn nobody heard is not a Turn in flight. What it does NOT do is fill the
    /// composer — the words were Argo's, and the reader has no second copy to send.
    func setHandoffTurnLost(for claim: SessionOwnership.ClaimID) {
        update(claim) { facts in
            facts.handoffTurnLost = true
            facts.submittedTurn = nil
        }
    }

    /// Both of the above, dropped in ONE write as a handoff begins and again as it ends: the words
    /// and the news about them belong to one attempt, and either left standing would answer for
    /// the next one. One write rather than two, so the roster moves once for one act.
    func forgetHandoffTurn(for claim: SessionOwnership.ClaimID) {
        update(claim) { facts in
            facts.handoffPrompt = nil
            facts.handoffTurnLost = false
        }
    }

    /// A handoff at this claim that did NOT land (#1327). Appended and never taken back, on the
    /// same ground `setTicket` is: the attempt happened, however the Session goes on. Unlike
    /// `settle`, nothing here is deduped by kind — a Session can be handed off from more than
    /// once, and each failed attempt is its own row.
    func recordHandoffFailure(_ failure: SessionWaitSettled, for claim: SessionOwnership.ClaimID) {
        update(claim) { $0.handoffFailures.append(failure) }
    }

    func setMode(_ modeSet: SessionModeSet, for claim: SessionOwnership.ClaimID) {
        update(claim) { $0.modeSet = modeSet }
    }

    /// The Model and Effort this claim's CLI was STARTED at (#1175). Never taken back: what Argo
    /// put on argv is something that happened, and the record's own reading is what supersedes it.
    func setRun(_ run: SessionRun, for claim: SessionOwnership.ClaimID) {
        update(claim) { $0.run = run }
    }

    /// A Turn Argo typed at this claim's PTY (#1048). Nothing takes one back when the record
    /// answers it — that reading is derived — so the only writes that clear it are the two below,
    /// where the Turn was never heard at all or the PTY it went down has gone.
    ///
    /// It retires a question the agent raised over the companion plugin in the same write (#1203),
    /// because those two are one act: the composer is where such a question is answered (#1205), so
    /// the Turn going down the PTY IS the answer. Which of the report's facts that touches is
    /// `CompanionReport`'s to say, as it is on withdrawal below.
    func setSubmittedTurn(
        _ submission: SessionTurnSubmission,
        for claim: SessionOwnership.ClaimID,
    ) {
        update(claim) { facts in
            facts.submittedTurn = submission
            facts.stopClaim = nil
            facts.report?.answered()
        }
    }

    /// The `ESC` Argo just put on this claim's PTY (#1644), and the Turn Argo typed ended with it.
    ///
    /// The mirror of `setSubmittedTurn` above: one is a Turn Argo started, this is a Turn Argo
    /// ended, and both are DIRECT because Argo performed the act.
    ///
    /// Filed UNCONDITIONALLY, unlike the guard below. Interrupted inside a tool call the assistant
    /// record carrying the call has already landed, so the submission is spent before the reader
    /// reaches for Stop — a stop filed only where one was standing files nothing in exactly the
    /// case #1644 reported.
    ///
    /// It ends the submission in the same write: a Turn Argo typed and then stopped is not a Turn
    /// in flight, whatever the record says next. That half stays idempotent rather than guarded —
    /// `update` publishes nothing that did not move (#858) — and a steer's send refiles its own
    /// submission behind this, dropping the stop with it.
    func setStopClaim(_ stop: SessionStopClaim, for claim: SessionOwnership.ClaimID) {
        update(claim) { facts in
            facts.stopClaim = stop
            facts.submittedTurn = nil
        }
    }

    /// Argo's claim that a Turn is in flight, ENDED by the delivery watch running out of `yet`
    /// (#1409) — `TurnDelivery.over(_:)` is the only caller, and the reader's own Stop goes through
    /// `setStopClaim` above instead.
    ///
    /// The submission ends on the record growing and on nothing else, which leaves one act with no
    /// way out: a Turn the CLI took and wrote no record for — a local `/command` writes none at all
    /// — never moves the count, so the Session reads `running` at DIRECT for the rest of the
    /// window's life. The watch is the bound, because the watch is the whole life of the claim.
    ///
    /// It takes ONLY the submission, and says nothing in its place: a watch that has stopped
    /// waiting has witnessed no act of Argo's to state, and a status the agent reported or the rung
    /// Argo set are things that happened, which giving up does not un-say.
    func stopSubmittedTurn(for claim: SessionOwnership.ClaimID) {
        // A watch that outlived a claim nothing filed files nothing: there is no claim of ours to
        // end, and publishing over an untouched claim would move the roster for it.
        guard byClaim[claim]?.submittedTurn != nil else { return }
        update(claim) { $0.submittedTurn = nil }
    }

    /// A Turn the CLI never heard (#682), or `nil` to take the news back once the composer has it.
    ///
    /// It ends the submission above in the same write, because the two are one act read in opposite
    /// directions: a Turn nobody heard is not a Turn in flight, and news of it arriving while the
    /// row still claimed one would draw the Session working on words it never received.
    func setLostTurn(_ text: String?, for claim: SessionOwnership.ClaimID) {
        update(claim) {
            $0.lostTurn = text
            $0.submittedTurn = nil
        }
    }

    /// One backgrounded delegation the reader ended from the rail (#1267).
    ///
    /// Only ever ADDS. Ending a delegation is the reader stating that its report is never coming,
    /// and nothing observed can contradict that — a report arriving afterwards closes the call in
    /// the record itself, which is where every surface reads the ending from anyway. So there is no
    /// verb here to take one back with, and nothing to keep this set consistent with.
    func endDelegation(_ callID: String, for claim: SessionOwnership.ClaimID) {
        update(claim) { $0.endedDelegations.insert(callID) }
    }

    /// The gate behind this claim is gone, so its three readings go, and so does everything that
    /// stood on the companion channel and the Turn Argo was driving down it — a claim about what a
    /// Session is doing NOW cannot outlive the channel it was witnessed on (#1048). What the agent
    /// PRODUCED and the rung Argo set are things that HAPPENED, so an orphaned Session keeps those
    /// rather than blanking. Which of the report's facts are which is `CompanionReport`'s to say,
    /// not the ledger's (#799).
    func withdraw(_ claim: SessionOwnership.ClaimID) {
        // A claim with nothing filed is not news: publishing over it would move the roster for a
        // teardown that changed nothing.
        guard byClaim[claim] != nil else { return }
        update(claim) { facts in
            facts.waiting = []
            facts.asking = []
            facts.standing = []
            facts.expiries = []
            facts.submittedTurn = nil
            // The `ESC` too, on the same ground and with the same consequence: a Session whose PTY
            // has gone reads `ended` off its orphaned provenance, which is louder news than the
            // quiet word this claim was holding (#1644).
            facts.stopClaim = nil
            facts.report?.channelClosed()
        }
    }

    /// The one write, and the one publish rule with it: a fact that did not move is not published
    /// (#858, ADR-0028 Rule 1). The revision is a dependency of every view that draws a Session,
    /// and the companion channel republishes `live` on every peer event one agent's socket sees.
    private func update(
        _ claim: SessionOwnership.ClaimID,
        _ change: (inout ClaimFacts) -> Void,
    ) {
        var facts = byClaim[claim] ?? ClaimFacts()
        change(&facts)
        let published = facts.isEmpty ? nil : facts
        guard byClaim[claim] != published else { return }
        byClaim[claim] = published
        revision += 1
    }
}
