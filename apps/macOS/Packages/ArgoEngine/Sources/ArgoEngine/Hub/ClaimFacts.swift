import Foundation

/// Everything Argo knows about one claim, under one key (#634).
///
/// Claim-keyed rather than Session-keyed for the reason every field here is: a claim exists before
/// the CLI has picked a Session id, and it outlives the reconciliation that gives the row one. A
/// fact filed under the id would be lost at the re-key.
struct ClaimFacts: Equatable {
    /// The CONVENTION tier, and the only place it comes from.
    var report: CompanionReport?
    /// Whether the channel that tier arrives over is up (#493). DIRECT — Argo owns the socket — and
    /// `notApplicable` where this claim has no channel at all, which is every CLI that takes no
    /// companion plugin. Kept when the claim is withdrawn, unlike the report's own standing claims:
    /// a channel that dropped is a thing that HAPPENED, and the orphaned row is where saying so
    /// earns its keep.
    var companionLiveness: CompanionLiveness = .notApplicable
    /// The Permissions this claim's agent is blocked on, oldest first.
    var waiting: [PermissionRequest] = []
    /// The questions it is blocked on (#712), oldest first. Apart from `waiting` because the two
    /// are answered by different acts: a Permission takes one word of two, a question takes
    /// whatever somebody chose.
    var asking: [SessionAsk] = []
    /// The tools it has stopped asking about (#572), in the order they were granted.
    var standing: [StandingAllow] = []
    /// The Permissions its gate ran out of patience for and refused itself (#573), oldest first.
    var expiries: [PermissionExpiry] = []
    /// The rung Argo last put it on (#545).
    var modeSet: SessionModeSet?
    /// What the CLI's own protocol says this Session is doing, off `codex app-server`'s
    /// `thread/status/changed` (#683). Absent for a `claude` claim, whose surface is a PTY with
    /// nothing on it to report.
    var driveStatus: SessionStatus?
    /// The last Turn typed at it that the CLI never heard, verbatim (#682). Held so the words can
    /// go back where they were typed: the composer cleared on the strength of a keystroke that was
    /// written, and this is the later news that it was never read.
    var lostTurn: String?
    /// The Ticket this claim was started ON (#872), by number. DIRECT: Argo was told which
    /// ticket at the spawn, so the Tickets room draws it claimed without waiting for a branch to be
    /// cut. Here rather than on the row alone because the row is re-keyed the moment its CLI
    /// writes a record, and a claim outlives that.
    var ticket: Int?

    /// Absent rather than empty: a claim with nothing to say must leave the ledger, or an empty
    /// entry keeps it alive there long after the PTY behind it went.
    var isEmpty: Bool {
        (report?.isEmpty ?? true)
            && companionLiveness == .notApplicable
            && waiting.isEmpty
            && asking.isEmpty
            && standing.isEmpty
            && expiries.isEmpty
            && modeSet == nil
            && driveStatus == nil
            && lostTurn == nil
            && ticket == nil
    }
}
