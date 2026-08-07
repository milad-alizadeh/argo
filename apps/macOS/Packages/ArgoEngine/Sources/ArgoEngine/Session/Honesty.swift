/// How we know a fact (CONTEXT.md, "Honesty tier"). A property of each rendered fact, never of a
/// session as a whole: one session mixes all three.
///
/// Ambiguity always resolves toward the lower tier. Argo never renders a false `direct`.
public enum Tier: String, Sendable, Equatable {
    /// Argo owns the fact.
    case direct
    /// Observed from outside Argo — inferred from a signal, or read verbatim from an external
    /// authority. A verbatim read is never reworded.
    case derived
    /// Arrived over the companion-plugin channel; never existed in a transcript. Managed only.
    case convention
}
