/// The two facts a driver has to know before it may move a Session's rung: where the Session
/// stands, and whether a Turn is in flight (#545).
///
/// A value rather than two closures, because the pair is read together and answering them from two
/// reads would let a rung be walked on the strength of a status taken a moment earlier.
struct SessionStance: Equatable {
    let mode: SessionModeReading
    let isRunning: Bool

    /// What a Session nothing is known about stands at: no rung, and quiet. Both halves are the
    /// refusing answer, which is what a stance read for a Session the roster has never heard of
    /// should be.
    static let unknown = SessionStance(mode: .unknown(cli: nil), isRunning: false)
}
