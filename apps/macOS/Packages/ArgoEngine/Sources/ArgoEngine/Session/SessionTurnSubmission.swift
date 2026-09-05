/// A Turn Argo itself wrote to a PTY it owns, and how many records the Session had written when it
/// did (#1048).
///
/// The submit is DIRECT — Argo performed it, so no poll has to corroborate that a Turn opened. What
/// the count is for is the END of that claim, which is the half #585 refused to leave out: a Turn
/// opened on Argo's own act and closed by nothing would stand over an agent that has long finished.
///
/// A COUNT and not the value of any record, for the reason `SessionModeSet` keeps one: the record
/// arrives long after the keystroke, and only "has the file grown since" can tell a record that has
/// not caught up from one that has.
struct SessionTurnSubmission: Equatable, Sendable {
    /// The words Argo typed, verbatim (#1278). Held for the same reason `ClaimFacts.lostTurn` holds
    /// its own: the composer clears on the keystroke, and until the record catches up this is the
    /// only copy of what was sent. It is what the feed draws in that window, so the reader sees
    /// their own words the frame they send them rather than a second of nothing.
    let text: String
    let recordsWhenSubmitted: Int

    /// Whether the record has yet to answer the Turn this stands for — the one window in which
    /// Argo's own submit is all that knows a Turn opened.
    ///
    /// It ends the moment the record grows, and it never comes back: the CLI has spoken, so what
    /// the Session is doing is the record's to say from then on. That is the honest FLOOR in #587's
    /// sense. Holding the claim across the whole Turn would mean deciding WHICH open Turn is the
    /// one Argo submitted, and the only rule available — "any open Turn" — would render a Turn
    /// typed at the dock terminal as one of Argo's own.
    func isAwaitingRecord(_ records: Int) -> Bool {
        records == recordsWhenSubmitted
    }
}
