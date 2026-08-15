import ArgoEngine

/// What the feed's ask row states, derived off the presentation the way
/// `PermissionPromptProjection.prompt(for:)` is — in a projection a test can hold still.
///
/// It answers one question: is the row on screen the one the gate is holding open, and may it be
/// pressed. Everything the row DRAWS it already has; this adds only the handle the answer travels
/// under.
enum FeedAskProjection {
    /// A question Argo can actually answer: the handles `answer` is keyed by, and the ask itself.
    struct Live: Equatable, Sendable {
        /// The roster's own id for the Session, and the gate's for the question. Both, because the
        /// answer must reach the question whose words are on screen — a Session with two questions
        /// up cannot say which one that is.
        let sessionID: String
        let askID: String
        /// What the gate is holding, matched against the row's own reading below. The two sides
        /// share no id: the hook payload names no record, and the transcript's call carries no
        /// request. They do carry the same `tool_input`, which is what makes the match exact.
        let ask: Ask
    }

    /// The live question, and nothing for a Session that is not blocked on one.
    ///
    /// Refused for a Session Argo cannot drive (#546), on the ground the Permission prompt is: an
    /// answer whose gate died with the PTY reaches nobody, so an affordance there is exactly the
    /// one that cannot work. The row above stays a reading, and the reason takes the deck's foot
    /// as `ComposerUnavailable` already draws it.
    static func live(for session: CockpitPresentation.Session?) -> Live? {
        guard let session, let ask = session.ask,
              SessionComposerProjection.unavailable(for: session) == nil
        else { return nil }
        return Live(sessionID: session.id, askID: ask.id, ask: ask.ask)
    }

    /// Whether this live question is the one that row is drawing.
    ///
    /// By VALUE and not by id, because there is no id either side shares. A weaker match than the
    /// Permission's, and honest about it: two identical questions in one Session would both match,
    /// and either is equally the one being answered — the words, the options and their order are
    /// the whole of what the user is looking at.
    static func matches(_ live: Live?, _ ask: Ask) -> Live? {
        guard let live, live.ask == ask else { return nil }
        return live
    }
}
