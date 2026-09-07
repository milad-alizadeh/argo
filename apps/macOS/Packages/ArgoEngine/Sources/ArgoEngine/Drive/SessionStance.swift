/// Where a Session stands and whether a Turn is in flight, read together so a rung cannot be
/// walked on the strength of a status taken a moment earlier (#545).
struct SessionStance: Equatable {
    let mode: SessionModeReading
    let isRunning: Bool
    /// Whether the CLI's prompt is free to take a typed line — `SessionStatus.takesTypedLine`
    /// (#1217). WIDER than `isRunning` above, and the two are kept apart on purpose: a Turn in
    /// flight is what a follow-up queues behind and what a Mode walk waits for.
    let takesTypedLine: Bool
    /// Whether a slash command typed at that prompt would be RUN —
    /// `SessionStatus.takesSlashCommand`
    /// (#1658). Narrower than `takesTypedLine` by one status, because the harness runs `/rename`
    /// and `/model` itself and a Turn in flight does not queue them; only a dialog holding the
    /// keyboard does.
    let takesSlashCommand: Bool

    /// What a Session the roster has never heard of stands at — every half refuses.
    static let unknown = SessionStance(
        mode: .unknown(cli: nil),
        isRunning: false,
        takesTypedLine: false,
        takesSlashCommand: false,
    )
}
