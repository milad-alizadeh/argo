import ArgoEngine

/// What the composer states about the Session it drives, derived the way the header's facts are:
/// off the presentation, in a projection a test can hold still.
enum SessionComposerProjection {
    struct Composer: Equatable {
        /// The handle `send` is keyed by — the roster's own id for the Session.
        let sessionID: String
        /// `Message Claude Code…` — addressed to the agent by name, because the field is how the
        /// user speaks to it.
        let placeholder: String
        /// What the Session runs at — `Opus 5` — stated on the composer and nowhere else once
        /// #558 moves it off the header (design decision 2). Effort joins it there too, when it
        /// is a value something actually holds.
        let facts: String?
        /// What this Session has stopped asking about (#572). On the composer because that is the
        /// surface a user is in front of every turn — a standing decision has to be findable
        /// without being looked for. Empty for a Session holding none, which draws no tray.
        let standingAllows: [StandingAllow]
        /// Whether a Turn is in flight, which is what decides where the next one goes: straight to
        /// the Session, or into the queue above the field. Read off the status rather than tracked
        /// here, so what the composer believes and what the header states cannot disagree.
        let isRunning: Bool
        /// Whether this Session's adapter takes attachments (#540). It comes IN rather than being
        /// derived from anything observed: a capability is a thing the adapter declares about
        /// itself, and the Hub's presentation has never heard of the drive port. `false` draws no
        /// `+` at all and refuses a drop with the reason (design decision 9).
        let canAttach: Bool
    }

    /// A composer only for a Session Argo can put keystrokes to: managed, and not over. Everything
    /// else gets NO composer rather than a disabled one — a greyed field invites a click and gives
    /// no reason (design decision 7); #546 gives the absence its words.
    static func composer(
        for session: CockpitPresentation.Session?,
        canAttach: Bool = false,
    )
        -> Composer? {
        guard let session, case .managed = session.access, session.status != .ended else {
            return nil
        }
        let isRunning = session.status == .running
        return Composer(
            sessionID: session.id,
            placeholder: isRunning ? queuePlaceholder : placeholder(addressing: session.cli),
            facts: session.model.map(ReadableModelName.readable),
            standingAllows: StandingAllowProjection.allows(for: session),
            isRunning: isRunning,
            canAttach: canAttach,
        )
    }

    /// What the field invites while a Turn is running. It says what pressing send will actually do
    /// — hold the words until the Turn ends — rather than going on offering to message an agent
    /// that is mid-sentence, which is the promise the queue exists because Argo cannot keep.
    static let queuePlaceholder = "Queue a follow-up…"

    /// Addressed to the agent when the record has named one, and to the role when it has not: a
    /// managed Session's first moments are a claim without a CLI's own record behind it.
    private static func placeholder(addressing cli: AgentCLI?) -> String {
        guard let cli else { return "Message the agent…" }
        return "Message \(cli.readableName)…"
    }
}
