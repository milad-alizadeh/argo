/// A rung Argo itself put a Session on, and how many stance records the Session had written when it
/// did.
///
/// Both halves are needed because `claude` writes its stance only at Turn boundaries. The rung is
/// what the Session stands on until a record is written AFTER the set, and the count is what says
/// whether one has been.
///
/// A count and not the value the record carried: a record that repeats the old value is the CLI
/// disagreeing, and one compared by value cannot tell that from a record that has not caught up
/// yet. Argo would then go on drawing a rung it merely asked for (#629).
public struct SessionModeSet: Equatable, Sendable {
    public let mode: SessionMode
    /// The adapter's exact permission value where this set came from its permission control.
    /// `nil` for the older generic Mode control, whose rung is already exact enough.
    public let permissionID: String?
    /// Zero at spawn, where nothing had been written yet — which is the same fact, not a gap.
    public let recordsWhenSet: Int

    public init(mode: SessionMode, permissionID: String? = nil, recordsWhenSet: Int = 0) {
        self.mode = mode
        self.permissionID = permissionID
        self.recordsWhenSet = recordsWhenSet
    }
}
