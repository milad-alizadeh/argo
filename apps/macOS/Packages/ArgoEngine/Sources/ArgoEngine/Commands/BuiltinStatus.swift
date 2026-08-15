/// How the read of the CLI's own built-ins went — the state of the picker's SLOWER half, pinned
/// above its list rather than drawn where the section would be (#686, design decision 9).
public enum BuiltinStatus: Equatable, Sendable {
    /// Read and curated. Whatever survived is in the catalog beside the skills.
    case read
    /// The hidden session is still being asked. The skills are all there; this half is not yet.
    case reading
    /// Argo could not read this CLI's built-ins. The skills stand and this half is honestly empty
    /// — never half a list presented as whole (decision 10).
    case unavailable
}
