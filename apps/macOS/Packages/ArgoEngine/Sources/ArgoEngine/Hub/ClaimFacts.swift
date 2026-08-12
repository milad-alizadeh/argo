import Foundation

/// Everything Argo knows about one claim, under one key (#634).
///
/// Claim-keyed rather than Session-keyed for the reason every field here is: a claim exists before
/// the CLI has picked a Session id, and it outlives the reconciliation that gives the row one. A
/// fact filed under the id would be lost at the re-key.
struct ClaimFacts: Equatable {
    /// The CONVENTION tier, and the only place it comes from.
    var report: CompanionReport?
    /// The Permissions this claim's agent is blocked on, oldest first.
    var waiting: [PermissionRequest] = []
    /// The tools it has stopped asking about (#572), in the order they were granted.
    var standing: [StandingAllow] = []
    /// The Permissions its gate ran out of patience for and refused itself (#573), oldest first.
    var expiries: [PermissionExpiry] = []
    /// The rung Argo last put it on (#545).
    var modeSet: SessionModeSet?
    /// The last Turn typed at it that the CLI never heard, verbatim (#682). Held so the words can
    /// go back where they were typed: the composer cleared on the strength of a keystroke that was
    /// written, and this is the later news that it was never read.
    var lostTurn: String?

    /// Absent rather than empty: a claim with nothing to say must leave the ledger, or an empty
    /// entry keeps it alive there long after the PTY behind it went.
    var isEmpty: Bool {
        (report?.isEmpty ?? true)
            && waiting.isEmpty
            && standing.isEmpty
            && expiries.isEmpty
            && modeSet == nil
            && lostTurn == nil
    }
}
