/// The only classification a Session stores (ADR-0013, CONTEXT.md "L2 · Session"): whether Argo
/// spawned it. Not a kind — every Session is observed, and this says what is layered on top.
public enum SessionProvenance: Sendable, Equatable, CaseIterable {
    /// Argo spawned it and owns its PTY: steerable, and the CONVENTION tier's only source.
    case managed
    /// Discovered from a transcript on disk. There is no channel to steer it down.
    case external
    /// Spawned managed by an Argo that is gone. Observation survives a restart, the PTY does not,
    /// so steering is unrecoverable — a posture of the same axis, not a fourth stored kind.
    case orphaned
}
