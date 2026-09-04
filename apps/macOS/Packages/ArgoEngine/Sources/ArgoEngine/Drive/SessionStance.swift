/// Where a Session stands and whether a Turn is in flight, read together so a rung cannot be
/// walked on the strength of a status taken a moment earlier (#545).
struct SessionStance: Equatable {
    let mode: SessionModeReading
    let isRunning: Bool
    /// Whether the CLI's prompt is free to take a typed line — `SessionStatus.takesTypedLine`
    /// (#1217). WIDER than `isRunning` above, and the two are kept apart on purpose: a Turn in
    /// flight is what a follow-up queues behind and what a Mode walk waits for, and a prompt that
    /// is merely busy is what a `/model` line may not be typed at.
    let takesTypedLine: Bool

    /// What a Session the roster has never heard of stands at — every half refuses.
    static let unknown = SessionStance(
        mode: .unknown(cli: nil),
        isRunning: false,
        takesTypedLine: false,
    )
}
