/// How far a branch has drifted from its upstream — git's own word for it, and both counts from
/// ONE reading, so the two can never disagree about which commits they were measured over.
///
/// Absent as a WHOLE for a branch with no upstream: there is nothing to be ahead of or behind, and
/// that is a different fact from being level with it.
public struct UpstreamDivergence: Equatable, Sendable {
    /// Commits the upstream has not seen — what the header calls unpushed.
    public let ahead: Int
    /// Commits the upstream has that HEAD does not.
    public let behind: Int

    public init(ahead: Int, behind: Int) {
        self.ahead = ahead
        self.behind = behind
    }
}
