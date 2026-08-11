/// What the ⓘ beside `CONTEXT` says: the two lines named, each wearing the ink it turns the
/// reading, and what the remedy actually does. Beside the projection so the words are assertable.
///
/// It **explains and does not report** (#502, story 42): nothing here is per-Session — the
/// thresholds are Argo's own policy and this is the same panel over every header.
extension SessionHeaderProjection.Context {
    /// One policy line, said the way the panel says it.
    struct GuideLine: Equatable, Sendable, Identifiable {
        /// `past 150k` — the threshold, not the Session's distance from it.
        let threshold: String
        let meaning: String
        /// Which ink the line is set in: the panel decodes the colour by WEARING it, never naming
        /// it.
        let tier: Tier

        var id: String {
            threshold
        }
    }

    static let guide: [GuideLine] = [
        GuideLine(
            threshold: "past \(TokenCount.short(SessionHeaderProjection.ContextPolicy.warn))",
            meaning: "handing off is worth doing",
            tier: .warn,
        ),
        GuideLine(
            threshold: "past \(TokenCount.short(SessionHeaderProjection.ContextPolicy.crit))",
            meaning: "handing off is overdue",
            tier: .crit,
        ),
    ]

    /// Names handing off as a thing that exists, not as a control on this header (#513).
    static let remedy = """
    A long context makes an agent slower and less accurate. Handing off runs /handoff in the \
    Session, then opens a fresh one on the same branch and issue, so the work continues rather \
    than restarting.
    """
}
