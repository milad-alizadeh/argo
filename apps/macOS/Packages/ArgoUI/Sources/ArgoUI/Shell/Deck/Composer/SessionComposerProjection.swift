import ArgoEngine

/// What the composer states about the Session it drives, derived the way the header's facts are:
/// off the presentation, in a projection a test can hold still.
package enum SessionComposerProjection {
    /// What the Session's adapter declares about itself. One type rather than three parallel flags
    /// because they travel together from `CockpitView` down to the vessel, and each is read off the
    /// drive port for the same Session at the same moment.
    struct Capabilities: Equatable {
        /// Whether this adapter takes attachments at all (#540).
        var canAttach = false
        /// Whether a `/command` fires the CLI's own command handling (#685).
        var canRunCommands = false
        /// Whether the CLI resolves an `@path` itself (#687). Where it does not, Argo names the
        /// file on its own line, so `@` is offered on both adapters where `/` is offered on one.
        var resolvesMentions = false
    }

    package struct Composer: Equatable {
        /// The handle `send` is keyed by — the roster's own id for the Session.
        package let sessionID: String
        /// `Message Claude Code…` — addressed to the agent by name, because the field is how the
        /// user speaks to it.
        package let placeholder: String
        /// What the Session runs at — `Opus 5` — stated on the composer and nowhere else once
        /// #558 moves it off the header (design decision 2). Effort joins it there too, when it
        /// is a value something actually holds.
        package let facts: String?
        /// What this Session has stopped asking about (#572). Empty for a Session holding none,
        /// which draws no tray.
        let standingAllows: [StandingAllow]
        /// Whether a Turn is in flight, which decides where the next one goes: straight to the
        /// Session, or into the queue above the field. Read off the status rather than tracked
        /// here, so the composer and the header cannot disagree.
        let isRunning: Bool
        /// The Session's standing stance as Argo can state it (#545, ADR-0025). The whole reading,
        /// because the `≈` and the CLI's own word are both things the control says.
        package let mode: SessionModeReading
        /// The rung the user picked that the CLI then contradicted (#629). The seam says so, and
        /// `mode` above is already back on the real rung — a picker showing a rung nobody is
        /// standing on would be a false DIRECT.
        let modeDidNotTake: SessionMode?
        /// The last Turn the CLI never heard, verbatim (#682). The field cleared when Argo typed
        /// it, so this is what puts the words back — and it is the words themselves rather than a
        /// flag, because a reader told their message was lost and not shown it has lost it.
        let lostTurn: String?
        /// Whether this Session's adapter takes attachments (#540). It comes IN rather than being
        /// derived from anything observed: a capability is a thing the adapter declares about
        /// itself, and the Hub's presentation has never heard of the drive port. `false` draws no
        /// `+` at all and refuses a drop with the reason (design decision 9).
        let canAttach: Bool
        /// Whether a `/command` sent to this Session fires the CLI's own command handling (#685).
        /// It comes IN for the reason `canAttach` does, and it is read PER SESSION: `claude`
        /// declares it and `codex` does not, so a joint answer would take the menu off both.
        /// `false` draws no menu and no command section anywhere — absent, not disabled.
        let canRunCommands: Bool
        /// Whether this Session's CLI resolves an `@path` mention itself (#687). Where it does not,
        /// the composer names the mentioned files on send, which is what puts their content in
        /// front of the agent on an adapter with no mention machinery of its own.
        var resolvesMentions = false
        /// Where the Session is working, which is the tree the `@` picker lists and the only tree
        /// it may offer a path out of (#687). Absent for a Session whose records have never said,
        /// which draws no `@` menu at all — there is no Workspace to name a file in.
        var workspaceRoot: String?
        /// The files this Session's agent has already read or edited, newest first (#687), stated
        /// relative to `workspaceRoot`. They sort to the top of the `@` menu, because the file the
        /// reader means next is nearly always one the agent has just been in.
        var touchedFiles: [String] = []

        /// Spelled out because Swift synthesises no memberwise initializer above
        /// `internal`, and the specimens build this from their own target (#1085).
        package init(
            sessionID: String,
            placeholder: String,
            facts: String?,
            standingAllows: [StandingAllow],
            isRunning: Bool,
            mode: SessionModeReading,
            modeDidNotTake: SessionMode?,
            lostTurn: String?,
            canAttach: Bool,
            canRunCommands: Bool,
            resolvesMentions: Bool = false,
            workspaceRoot: String? = nil,
            touchedFiles: [String] = [],
        ) {
            self.sessionID = sessionID
            self.placeholder = placeholder
            self.facts = facts
            self.standingAllows = standingAllows
            self.isRunning = isRunning
            self.mode = mode
            self.modeDidNotTake = modeDidNotTake
            self.lostTurn = lostTurn
            self.canAttach = canAttach
            self.canRunCommands = canRunCommands
            self.resolvesMentions = resolvesMentions
            self.workspaceRoot = workspaceRoot
            self.touchedFiles = touchedFiles
        }
    }

    /// A composer only for a Session Argo can put keystrokes to: managed, and not over. Everything
    /// else gets NO composer rather than a disabled one (design decision 7; #546).
    ///
    /// Refused through `unavailable(for:)` rather than by a guard of its own, so the vessel and the
    /// line that replaces it cannot come to disagree about who can be driven — one of them is on
    /// screen for every Session, and never both.
    static func composer(
        for session: CockpitPresentation.Session?,
        can: Capabilities = Capabilities(),
    )
        -> Composer? {
        guard let session, unavailable(for: session) == nil else { return nil }
        let isRunning = session.status == .running
        return Composer(
            sessionID: session.id,
            placeholder: isRunning ? queuePlaceholder : placeholder(addressing: session.cli),
            facts: session.model.map(ReadableModelName.readable),
            standingAllows: StandingAllowProjection.allows(for: session),
            isRunning: isRunning,
            mode: session.mode,
            modeDidNotTake: session.modeDidNotTake,
            lostTurn: session.lostTurn,
            canAttach: can.canAttach,
            canRunCommands: can.canRunCommands,
            resolvesMentions: can.resolvesMentions,
            workspaceRoot: session.workspaceLocation,
            touchedFiles: TouchedFiles.touched(
                in: session.events,
                within: session.workspaceLocation,
            ),
        )
    }

    /// What the field invites while a Turn is running: send holds the words until the Turn ends.
    package static let queuePlaceholder = "Queue a follow-up…"

    /// Addressed to the agent when the record has named one, and to the role when it has not: a
    /// managed Session's first moments are a claim without a CLI's own record behind it.
    private static func placeholder(addressing cli: AgentCLI?) -> String {
        guard let cli else { return "Message the agent…" }
        return "Message \(cli.readableName)…"
    }
}
