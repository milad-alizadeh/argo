/// An `ESC` Argo itself put on a PTY it owns, and how many records the Session had written when it
/// did (#1644).
///
/// The mirror of `SessionTurnSubmission`, DIRECT on exactly its ground: Argo performed the
/// keystroke, so the Turn ENDING is a thing it witnessed rather than one a poll has to corroborate.
/// It exists for the one case liveness cannot reach. `ESC` ends a Turn and keeps the process
/// (ADR-0024), and interrupted inside a tool call the CLI writes no sentence for the act at all —
/// measured on four roster rows, three of which ended on an assistant record carrying
/// `stop_reason: tool_use` and drew `running` over a Session nothing had run in for two hours.
///
/// A COUNT and not a moment, for `SessionTurnSubmission`'s reason: the record arrives long after
/// the keystroke, and only "has the file grown since" tells a record that has not caught up from
/// one that has. Never a timeout — the claim ends where Argo can witness it ending.
struct SessionStopClaim: Equatable, Sendable {
    let recordsWhenStopped: Int

    /// Whether the record has yet to answer the `ESC` this stands for — the one window in which
    /// Argo's own keystroke is all that knows the Turn ended.
    ///
    /// It ends the moment the record grows and never comes back: the CLI has spoken, so what the
    /// Session is doing is the record's to say from then on. Standing for hours is honest rather
    /// than stale here, because the case this was built for is the record saying NOTHING.
    func isAwaitingRecord(_ records: Int) -> Bool {
        records == recordsWhenStopped
    }
}
