/// A rung Argo itself put a Session on, with the CLI value the record carried at the time.
///
/// Both halves are needed because `claude` writes its stance only at Turn boundaries. The rung is
/// what the Session stands on until the record moves, and `observedWhenSet` is how the reading
/// tells a record that has not caught up from one that says something new.
public struct SessionModeSet: Equatable, Sendable {
    public let mode: SessionMode
    /// `nil` at spawn, where nothing had been written yet — which is the same fact, not a gap.
    public let observedWhenSet: String?

    public init(mode: SessionMode, observedWhenSet: String? = nil) {
        self.mode = mode
        self.observedWhenSet = observedWhenSet
    }
}
