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
        /// What this Session has stopped asking about (#572). Empty for a Session holding none,
        /// which draws no tray.
        let standingAllows: [StandingAllow]
        /// Whether a Turn is in flight, which decides where the next one goes: straight to the
        /// Session, or into the queue above the field. Read off the status rather than tracked
        /// here, so the composer and the header cannot disagree.
        let isRunning: Bool
        /// The Session's standing stance as Argo can state it (#545, ADR-0025) — what the footer's
        /// `ModePicker` draws. The whole reading rather than a rung: an approximation and the CLI's
        /// own word for it are both things the control says.
        let mode: SessionModeReading
        /// Whether this Session's adapter takes attachments (#540). It comes IN rather than being
        /// derived from anything observed: a capability is a thing the adapter declares about
        /// itself, and the Hub's presentation has never heard of the drive port. `false` draws no
        /// `+` at all and refuses a drop with the reason (design decision 9).
        let canAttach: Bool
    }

    /// A composer only for a Session Argo can put keystrokes to: managed, and not over. Everything
    /// else gets NO composer rather than a disabled one (design decision 7; #546).
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
            mode: session.mode,
            canAttach: canAttach,
        )
    }

    /// What the field invites while a Turn is running: send holds the words until the Turn ends.
    static let queuePlaceholder = "Queue a follow-up…"

    /// Addressed to the agent when the record has named one, and to the role when it has not: a
    /// managed Session's first moments are a claim without a CLI's own record behind it.
    private static func placeholder(addressing cli: AgentCLI?) -> String {
        guard let cli else { return "Message the agent…" }
        return "Message \(cli.readableName)…"
    }
}
