/// Everything a Session's status is read from: what its transcript observed, and what Argo knows
/// about the process behind it.
///
/// A value rather than five parameters, so the derivation stays a pure function of what was
/// observed and a test can vary one signal at a time.
public struct SessionSignals: Sendable, Equatable {
    /// Which posture of the `managed | external` axis this Session is on. Gates the two statuses a
    /// transcript alone cannot honestly carry.
    public let provenance: SessionProvenance
    public let liveness: SessionLiveness
    /// A prompt with no boundary after it.
    public let turnOpen: Bool
    /// Why the last Turn ended, where one has. `nil` is no boundary observed at all — a different
    /// claim from a boundary whose word we could not read, which is `.unknown`.
    public let lastStop: StopReason?
    /// An `AskUserQuestion` in the open Turn that no result has answered.
    public let pendingAsk: Bool

    public init(
        provenance: SessionProvenance,
        liveness: SessionLiveness,
        turnOpen: Bool,
        lastStop: StopReason?,
        pendingAsk: Bool,
    ) {
        self.provenance = provenance
        self.liveness = liveness
        self.turnOpen = turnOpen
        self.lastStop = lastStop
        self.pendingAsk = pendingAsk
    }

    /// Whether the record carries a Turn boundary at all. Nothing observed is a different claim
    /// from observed to be quiet, and this is the fact that tells them apart.
    var hasTurns: Bool {
        turnOpen || lastStop != nil
    }
}
