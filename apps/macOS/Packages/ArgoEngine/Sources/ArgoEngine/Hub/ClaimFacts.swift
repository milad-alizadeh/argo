import Foundation

/// Everything Argo knows about one claim, under one key (#634).
///
/// Claim-keyed rather than Session-keyed for the reason every field here is: a claim exists before
/// the CLI has picked a Session id, and it outlives the reconciliation that gives the row one. A
/// fact filed under the id would be lost at the re-key.
struct ClaimFacts: Equatable {
    /// The CONVENTION tier, and the only place it comes from.
    var report: CompanionReport?
    /// Whether the channel that tier arrives over is up (#493). Kept when the claim is withdrawn,
    /// unlike the report's own standing claims: a channel that dropped is a thing that HAPPENED, so
    /// it holds this entry in the ledger the way `ticket` and `modeSet` already do.
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
    /// The Model and Effort Argo STARTED it at (#1175) — DIRECT, because Argo spelled both on
    /// argv. Absent for a claim on a CLI that takes neither flag, and for every external Session,
    /// which has no claim at all.
    var run: SessionRun?
    /// What the CLI's own protocol says this Session is doing, off `codex app-server`'s
    /// `thread/status/changed` (#683). Absent for a `claude` claim, whose surface is a PTY with
    /// nothing on it to report.
    var driveStatus: SessionStatus?
    /// The last Turn Argo typed at this claim's PTY, and the record count when it did (#1048) —
    /// DIRECT, because Argo performed the submit. Whether that Turn is STILL running is
    /// `SessionTurnSubmission.isRunning`'s answer and not this field's, so it outlives the Turn it
    /// stands for. Unreachable for an external Session, which has no claim to file one against.
    var submittedTurn: SessionTurnSubmission?
    /// The last Turn typed at it that the CLI never heard, verbatim (#682). Held so the words can
    /// go back where they were typed: the composer cleared on the strength of a keystroke that was
    /// written, and this is the later news that it was never read.
    var lostTurn: String?
    /// The waits Argo held at this claim that have ENDED (#1323), in the order they ended. Never
    /// taken back and never edited: a wait that ran is something that happened, so an orphaned
    /// Session still carries what its start took. Here rather than on the row alone because the row
    /// is re-keyed the moment its CLI writes a record, and the spawn that held the wait is retired
    /// at exactly that moment.
    var settledWaits: [SessionWaitSettled] = []
    /// The Ticket this claim was started ON (#872), by number. DIRECT: Argo was told which
    /// ticket at the spawn, so the Tickets room draws it claimed without waiting for a branch to be
    /// cut. Here rather than on the row alone because the row is re-keyed the moment its CLI
    /// writes a record, and a claim outlives that.
    var ticket: Int?

    /// Spelled out and taking NOTHING, which suppresses the memberwise init Swift would otherwise
    /// synthesise across every field above. Nothing builds one from a list — the ledger starts from
    /// an empty value and folds one fact into it at a time — so the list would be a signature no
    /// caller wants and every new fact widens.
    init() {}

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
            && run == nil
            && driveStatus == nil
            && submittedTurn == nil
            && lostTurn == nil
            && settledWaits.isEmpty
            && ticket == nil
    }
}
