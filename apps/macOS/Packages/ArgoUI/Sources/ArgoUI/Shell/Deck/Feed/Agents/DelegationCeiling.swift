/// How long a delegation may stand unresolved before its silence reads as a LOST REPORT rather than
/// as work still going on (`CONTEXT.md` L3 · Subagent).
///
/// The THIRD fact behind every "still running" claim the rail makes, beside the record's own
/// `pending` and `DelegatingSession`. Those two leave one permanent lie standing, and it is the one
/// the reader kept seeing: a Session that IS running, holding delegations from a day ago. A
/// backgrounded delegation is closed by exactly one thing — the `task-notification` the host files
/// when the child stops (#908, #825) — and where that notification is lost, nothing in the record
/// will ever close the call. #1089 keyed the dots off the Session's status and could not reach
/// these, so the rail went on saying `21 running` at 47h 15m.
///
/// **A stated ceiling, not an observation, and it is named as one.** Argo cannot see a backgrounded
/// child's process; the honest floor is that no report can still be in flight after this long.
/// MEASURED off this machine's own record rather than picked: of 576 delegations whose reports did
/// land, half landed inside 3 minutes, 99% inside 92 minutes, and exactly one ever exceeded four
/// hours — itself a notification delivered to a Session that had been idle since. Four hours clears
/// every delegation the record has been seen to finish, with the width doubled over the measurement
/// so a slow Subagent is not quieted merely for being slow.
///
/// **One-directional, which is what keeps it from inventing a state.** It only ever TAKES a running
/// claim away, on the evidence of an age. A delegation the record never timestamped has no age to
/// judge, so this makes no claim about it and the other two facts decide — absence of evidence is
/// not evidence of staleness, and reading it as one would quiet a live fan-out on a host that
/// stamps nothing.
enum DelegationCeiling {
    /// Four hours. Its own value so a suite can reach the number the code uses rather than
    /// restate it, and so the argument for it above sits on the figure itself. Named for what it
    /// bounds — how long a report can still be in flight — the way `recentActivityWindowMs` is.
    static let reportWindowMs = 4 * 60 * 60 * 1000

    /// Whether a delegation handed over at `handedOverAtMs` has stood open past the ceiling.
    /// `false` for one the record did not date, per the note above.
    static func passed(handedOverAtMs: Int?, nowMs: Int) -> Bool {
        guard let handedOverAtMs else { return false }
        return nowMs - handedOverAtMs > reportWindowMs
    }
}
