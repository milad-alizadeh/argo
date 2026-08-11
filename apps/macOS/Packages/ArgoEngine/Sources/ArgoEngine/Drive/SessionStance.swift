/// Where a Session stands and whether a Turn is in flight, read together so a rung cannot be
/// walked on the strength of a status taken a moment earlier (#545).
struct SessionStance: Equatable {
    let mode: SessionModeReading
    let isRunning: Bool

    /// What a Session the roster has never heard of stands at — both halves refuse.
    static let unknown = SessionStance(mode: .unknown(cli: nil), isRunning: false)
}
