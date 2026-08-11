import ArgoEngine

/// Whether the header offers to hand this Session's work to a fresh one, and in what state.
///
/// The spec's own line, spelled in Swift and nowhere else in the app:
///
///     handoff(s) = tier(s) ∈ {.warn, .crit} && s.access == .managed && s.handedOffTo == nil
///
/// Three facts and no fourth. Handing off means TYPING at a prompt, and Argo owns no prompt on an
/// external or an orphaned Session (story 49) — the coloured reading still warns, the button is not
/// drawn. A Session that has already handed over keeps its coloured reading and its link to the
/// Session that took it; a second press would fork the branch rather than chain it.
extension SessionHeaderProjection {
    struct Handoff: Equatable, Sendable {
        /// The verb, and the whole of the control's ink — **no caption** (story 46).
        let label: String
        /// What the control reads while the handoff is running. `/handoff` is a whole turn of an
        /// agent's work, so the press is answered in minutes rather than instantly, and each press
        /// starts another handoff.
        let runningLabel: String
        /// Which reading the button is standing beside, so its urgency is the same fact as the
        /// reading's (story 45). Never `.okay` and never absent.
        let tier: Context.Tier
        /// One sentence, which is the whole tooltip: what handing off DOES.
        let detail: String
        /// Why it cannot be launched, or `nil` when it can. Present means the control is drawn and
        /// DISABLED with this sentence on it.
        let blocked: String?

        var isLaunchable: Bool {
            blocked == nil
        }
    }

    /// The one sentence the control spends.
    private enum HandoffWords {
        static let label = "Hand off"
        static let running = "Handing off…"
        static let detail = "Runs /handoff in this Session, then opens a fresh one on the same "
            + "branch and issue."
    }

    static func handoff(from session: CockpitPresentation.Session) -> Handoff? {
        guard session.access == .managed,
              session.handedOffTo == nil,
              let tier = context(tokens: session.contextTokens).tier,
              tier != .okay
        else { return nil }
        return Handoff(
            label: HandoffWords.label,
            runningLabel: HandoffWords.running,
            tier: tier,
            detail: HandoffWords.detail,
            // The refusal's wording is the ENGINE's, read off the failure the orchestration would
            // raise, so the tooltip and the alert cannot drift apart.
            blocked: session.workspaceLocation == nil
                ? SessionHandoff.Failure.noFolder.detail
                : nil,
        )
    }
}
