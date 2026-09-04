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
            facts.report?.answered()
        }
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
