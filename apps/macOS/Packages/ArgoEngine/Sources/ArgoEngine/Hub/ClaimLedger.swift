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

    func setMode(_ modeSet: SessionModeSet, for claim: SessionOwnership.ClaimID) {
        update(claim) { $0.modeSet = modeSet }
    }

    /// The gate behind this claim is gone, so its three readings go — but the record stays. What
    /// the agent said and the rung Argo set are things that HAPPENED, so an orphaned Session keeps
    /// reading as what it was rather than blanking when its PTY exits.
    func withdraw(_ claim: SessionOwnership.ClaimID) {
        // A claim with nothing filed is not news: publishing over it would move the roster for a
        // teardown that changed nothing.
        guard byClaim[claim] != nil else { return }
        update(claim) { facts in
            facts.waiting = []
            facts.standing = []
            facts.expiries = []
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
