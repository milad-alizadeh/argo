import ArgoEngine

/// Whether the header offers to hand this Session's work to a fresh one, and in what state.
///
/// The spec's own line, spelled in Swift and nowhere else in the app:
///
///     handoff(s) = tier(s) ∈ {.warn, .crit} && s.access == .managed
///
/// Two facts and no third. It is not offered under the WARN line because a control that is always
/// there is a control nobody reads by the second Session (#502, story 44) — the remedy appears at
/// the moment it is the right move and not before. It is not offered on a Session Argo cannot drive
/// because handing off means TYPING at a prompt, and Argo owns no prompt on an external or an
/// orphaned Session (story 49): the coloured reading still warns, and the button that would lie
/// about what Argo can do is simply not drawn.
extension SessionHeaderProjection {
    struct Handoff: Equatable, Sendable {
        /// The verb, and the whole of the control's ink — **no caption** (story 46): the coloured
        /// reading beside it and the ⓘ above it have already made that argument.
        let label: String
        /// What the control reads while the handoff is running. `/handoff` is a whole turn of an
        /// agent's work, so the press is answered in minutes rather than instantly — a button that
        /// looked untouched for that long would be pressed again, and each press starts another
        /// handoff.
        let runningLabel: String
        /// Which reading the button is standing beside, so its urgency is the same fact as the
        /// reading's rather than a second one drawn in whatever colour a view picked (story 45).
        /// Never `.okay` and never absent — a button that exists is a button past a line.
        let tier: Context.Tier
        /// One sentence, which is the whole tooltip. What handing off DOES, not why a long context
        /// is bad — that argument is the ⓘ panel's and is already made there.
        let detail: String
        /// Why it cannot be launched, or `nil` when it can. Present means the control is drawn and
        /// DISABLED with this sentence on it: a remedy that silently does nothing is worse than one
        /// that says what is in its way.
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
              let tier = context(tokens: session.contextTokens).tier,
              tier != .okay
        else { return nil }
        return Handoff(
            label: HandoffWords.label,
            runningLabel: HandoffWords.running,
            tier: tier,
            detail: HandoffWords.detail,
            // The refusal's wording is the ENGINE's, read off the failure the orchestration would
            // raise. One rule and one sentence: the tooltip that explains a disabled button and the
            // alert that reports the same refusal cannot drift apart.
            blocked: session.workspaceLocation == nil
                ? SessionHandoff.Failure.noFolder.detail
                : nil,
        )
    }
}
