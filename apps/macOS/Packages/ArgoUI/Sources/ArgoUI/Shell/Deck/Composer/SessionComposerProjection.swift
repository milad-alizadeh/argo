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
        /// Which of the CLI's own two knobs this adapter can be SET on (#558). One value, the way
        /// the port declares it: a knob it does not answer for leaves its section OUT of the
        /// run-settings popover — absent, not disabled.
        var chooses = RunFactKnobs()
    }

    package struct Composer: Equatable {
        /// The handle `send` is keyed by — the roster's own id for the Session.
        package let sessionID: String
        /// `Message Claude Code…` — addressed to the agent by name, because the field is how the
        /// user speaks to it.
        package let placeholder: String
        /// What the Session runs at — `Opus 5 · Medium` — stated on the composer and nowhere else
        /// (design decision 2, #558). The whole reading, because what the trigger says, what the
        /// popover ticks and which sections it draws are all things this one value settles.
        package let facts: RunFacts
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
        /// Whether the Turn is OVER — the question the queue above the field waits on, and a
        /// different one from `isRunning` (#1238).
        ///
        /// `permission` and `asking` are mid-Turn PAUSES: no Turn is running at either, and
        /// neither is the Turn's end. Releasing a follow-up there would put it to a CLI holding a
        /// question open. `starting` is not an end either: Argo started the process and has not
        /// heard it yet.
        ///
        /// Set after the init rather than through it, for the reason `endedByInterrupt` below is.
        /// It defaults to the negation of `isRunning`, which is the reading every fixture built
        /// before this existed meant: production always states it off the status.
        var hasTurnEnded: Bool

        /// Whether the last Turn boundary the record carries is somebody STOPPING the Turn
        /// (#1189) — see `SessionComposerProjection.endedByInterrupt(_:)`. What the composer
        /// answers a Turn's end with: a Turn that simply finished releases what was queued behind
        /// it, and a Turn that was stopped drops it.
        ///
        /// Set after the init rather than through it, and deliberately: that list is at the count
        /// it is grandfathered at (`swift-boundaries` edge 6), and one more would authorise the
        /// next one. A specimen that wants this state sets it the same way.
        var endedByInterrupt = false

        /// Spelled out because Swift synthesises no memberwise initializer above
        /// `internal`, and the specimens build this from their own target (#1085).
        package init(
            sessionID: String,
            placeholder: String,
            facts: RunFacts,
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
            self.hasTurnEnded = !isRunning
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
        // Handed out ONCE and walked twice. The count that gates the selection pass is of stream
        // hand-outs (`PerfBudgets.selectionPassReads`), so reaching for `session.events` a second
        // time would cost a read whether or not the walk behind it is cheap — and this one is
        // bounded by the open Turn where the other is linear in the whole transcript.
        let events = session.events
        var composer = Composer(
            sessionID: session.id,
            placeholder: isRunning ? queuePlaceholder : placeholder(addressing: session.cli),
            facts: RunFacts(
                model: session.model,
                // Read here rather than held: `effort` comes off the records verbatim, and what it
                // means on the scale is the engine's to say (`ClaudeEffort`).
                effort: session.effort.map(ClaudeEffort.reading) ?? .unknown(cli: nil),
                chooses: can.chooses,
            ),
            standingAllows: StandingAllowProjection.allows(for: session),
            isRunning: isRunning,
            mode: session.mode,
            modeDidNotTake: session.modeDidNotTake,
            lostTurn: session.lostTurn,
            canAttach: can.canAttach,
            canRunCommands: can.canRunCommands,
            resolvesMentions: can.resolvesMentions,
            workspaceRoot: session.workspaceLocation,
            touchedFiles: TouchedFiles.touched(in: events, within: session.workspaceLocation),
        )
        composer.hasTurnEnded = hasTurnEnded(session.status)
        composer.endedByInterrupt = endedByInterrupt(events)
        return composer
    }

    /// Whether this status says the Turn is over (#1238).
    ///
    /// `running` and `starting` are a Turn in flight. `permission` and `asking` are a Turn PAUSED
    /// on a question — the CLI's prompt is holding it, and nothing waiting may be put yet. The
    /// four quiet readings are the Turn's end.
    ///
    /// `unknown` is an end, which is degrade-down read at this seam rather than against it: it is
    /// the reading this composer already treated as not-running, and holding the queue there would
    /// strand it behind a status that, by its own definition, nothing will ever move.
    package static func hasTurnEnded(_ status: SessionStatus) -> Bool {
        switch status {
        case .running, .starting, .permission, .asking: false
        case .idle, .stopped, .ended, .unknown: true
        }
    }

    /// What the field invites while a Turn is running: send holds the words until the Turn ends.
    package static let queuePlaceholder = "Queue a follow-up…"

    /// Whether the last Turn boundary the record carries is somebody STOPPING the Turn (#1189).
    ///
    /// Read off the RECORD rather than off Argo's own Stop button, which is the whole point: an
    /// `ESC` typed at the dock terminal, or a Stop pressed in another window, ends the Turn just
    /// as truly — and until the marker was read as CLOSING the Turn, no such Session ever came off
    /// `running`, so the composer never had to answer for one. Left unanswered it would RELEASE
    /// the follow-ups waiting on that Turn, which is what design decision 4 forbids.
    ///
    /// Backwards to the nearest boundary and no further: what ended the LAST Turn is the question,
    /// and every Turn before it has its own answer that no longer matters.
    package static func endedByInterrupt(_ events: [TranscriptEvent]) -> Bool {
        for event in events.reversed() {
            switch event {
            case .interrupted:
                return true
            case .turnEnded:
                return false
            default:
                break
            }
        }
        return false
    }

    /// Addressed to the agent when the record has named one, and to the role when it has not: a
    /// managed Session's first moments are a claim without a CLI's own record behind it.
    private static func placeholder(addressing cli: AgentCLI?) -> String {
        guard let cli else { return "Message the agent…" }
        return "Message \(cli.readableName)…"
    }
}
