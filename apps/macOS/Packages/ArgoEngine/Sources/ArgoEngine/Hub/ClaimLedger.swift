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

    func setMode(_ modeSet: SessionModeSet, for claim: SessionOwnership.ClaimID) {
        update(claim) { $0.modeSet = modeSet }
    }

    /// A Turn the CLI never heard (#682), or `nil` to take the news back once the composer has it.
    func setLostTurn(_ text: String?, for claim: SessionOwnership.ClaimID) {
        update(claim) { $0.lostTurn = text }
    }

    /// The gate behind this claim is gone, so its three readings go, and so does everything that
    /// stood on the companion channel. What the agent PRODUCED and the rung Argo set are things
    /// that HAPPENED, so an orphaned Session keeps those rather than blanking. Which of the
    /// report's facts are which is `CompanionReport`'s to say, not the ledger's (#799).
    func withdraw(_ claim: SessionOwnership.ClaimID) {
        // A claim with nothing filed is not news: publishing over it would move the roster for a
        // teardown that changed nothing.
        guard byClaim[claim] != nil else { return }
        update(claim) { facts in
            facts.waiting = []
            facts.asking = []
            facts.standing = []
            facts.expiries = []
            facts.report?.channelClosed()
        }
    }

    private func update(
        _ claim: SessionOwnership.ClaimID,
        _ change: (inout ClaimFacts) -> Void,
    ) {
        var facts = byClaim[claim] ?? ClaimFacts()
        change(&facts)
        byClaim[claim] = facts.isEmpty ? nil : facts
    }
}
