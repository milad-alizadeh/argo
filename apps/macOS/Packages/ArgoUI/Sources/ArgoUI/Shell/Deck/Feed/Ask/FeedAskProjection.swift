import ArgoEngine

/// What the feed's ask row states, derived off the presentation the way
/// `PermissionPromptProjection.prompt(for:)` is — in a projection a test can hold still.
///
/// It answers two questions the row cannot: is the row on screen the one the gate is holding open,
/// and can this Session be driven at all. They are separate because their absences mean opposite
/// things — see `Asking`.
package enum FeedAskProjection {
    /// A question Argo can actually answer: the handles `answer` is keyed by, and the ask itself.
    package struct Live: Equatable, Sendable {
        /// The roster's own id for the Session, and the gate's for the question. Both, because the
        /// answer must reach the question whose words are on screen — a Session with two questions
        /// up cannot say which one that is.
        let sessionID: String
        let askID: String
        /// What the gate is holding, matched against the row's own reading below. The two sides
        /// share no id: the hook payload names no record, and the transcript's call carries no
        /// request. They do carry the same `tool_input`, which is what makes the match exact.
        let ask: Ask

        /// Spelled out because Swift synthesises no memberwise initializer above
        /// `internal`, and the specimens build this from their own target (#1085).
        package init(sessionID: String, askID: String, ask: Ask) {
            self.sessionID = sessionID
            self.askID = askID
            self.ask = ask
        }
    }

    /// What the feed is told about answering, for one Session.
    ///
    /// Two facts and not one, because `live == nil` alone cannot say why. A Session Argo cannot
    /// drive has no affordance AND no attention — nothing reaches the agent, so nothing is waiting
    /// on the user (#546). A DRIVEABLE Session with no live question is a different state: the
    /// gate may not have raised it yet, or Argo restarted under a CLI still holding it, and there
    /// the row keeps the honest "still waiting" reading #534 shipped. Collapsing the two would
    /// render a question nobody has answered as one somebody did.
    package struct Asking: Equatable, Sendable {
        let live: Live?
        let isDriveable: Bool

        /// What a feed with no Session behind it is told — a preview, a specimen, a render.
        /// Driveable, because those are readings of a live cockpit and not of a dead Session.
        static let none = Asking(live: nil, isDriveable: true)

        /// Spelled out because Swift synthesises no memberwise initializer above
        /// `internal`, and the specimens build this from their own target (#1085).
        package init(live: Live?, isDriveable: Bool) {
            self.live = live
            self.isDriveable = isDriveable
        }
    }

    static func asking(for session: CockpitPresentation.Session?) -> Asking {
        guard let session else { return .none }
        let isDriveable = SessionComposerProjection.unavailable(for: session) == nil
        return Asking(live: live(for: session), isDriveable: isDriveable)
    }

    /// The live question, and nothing for a Session that is not blocked on one.
    ///
    /// Refused for a Session Argo cannot drive, on the ground the Permission prompt is: an answer
    /// whose gate died with the PTY reaches nobody, so an affordance there is exactly the one that
    /// cannot work.
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
    static func matches(_ live: Live?, _ ask: Ask) -> Bool {
        live?.ask == ask
    }
}
