/// A Turn Argo itself wrote to a PTY it owns, and how many records the Session had written when it
/// did (#1048).
///
/// The submit is DIRECT — Argo performed it, so no poll has to corroborate that a Turn opened. What
/// the count is for is the END of that claim, which is the half #585 refused to leave out: a Turn
/// opened on Argo's own act and closed by nothing would stand over an agent that has long finished.
///
/// A COUNT and not the value of any record, for the reason `SessionModeSet` keeps one: the record
/// arrives long after the keystroke, and only "has the file grown since" can tell a record that has
/// not caught up from one that says the Turn is over.
struct SessionTurnSubmission: Equatable, Sendable {
    /// Zero for a Session that had written nothing when the Turn was typed at it, which is the same
    /// fact and not a gap.
    let recordsWhenSubmitted: Int

    /// Whether the Turn this stands for is still the one running.
    ///
    /// Two states, and the record tells them apart. While it has not grown at all, nothing has yet
    /// had the chance to say the Turn ended, so Argo's own submit is the whole of what is known.
    /// Once it has, the record's Turn boundaries are what answer — and a record that has moved
    /// without opening a Turn ends the claim, which under-reports the Turn rather than standing on
    /// it (`CONTEXT.md` Honesty tier, degrade-down).
    func isRunning(records: Int, turn: SessionTurnState) -> Bool {
        records == recordsWhenSubmitted || turn.isOpen
    }
}
