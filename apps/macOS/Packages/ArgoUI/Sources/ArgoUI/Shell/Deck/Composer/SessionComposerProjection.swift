import ArgoEngine

/// What the composer states about the Session it drives, derived the way the header's facts are:
/// off the presentation, in a projection a test can hold still.
package enum SessionComposerProjection {
    /// What the Session's adapter declares about itself. One type rather than three parallel flags
    /// because they travel together from `CockpitView` down to the vessel, and each is read off the
    /// drive port for the same Session at the same moment.
    /// `package` so the specimen deck can ask for the WHOLE projection rather than hand-building a
    /// `Composer` (#1179): a case about what the projection derives off a status proves nothing
    /// when the fixture states the derivation itself.
    package struct Capabilities: Equatable {
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

        /// Spelled out because Swift's synthesised memberwise init for a `package` struct is
        /// `internal`, and the specimens build this from their own target.
        package init(
            canAttach: Bool = false,
            canRunCommands: Bool = false,
            resolvesMentions: Bool = false,
            chooses: RunFactKnobs = RunFactKnobs(),
        ) {
            self.canAttach = canAttach
            self.canRunCommands = canRunCommands
            self.resolvesMentions = resolvesMentions
            self.chooses = chooses
        }
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
        /// Whether a Turn is in flight, which is where the NEXT one goes: straight to the Session,
        /// or onto the queue above the field (#1179).
        ///
        /// A third question at this reading, and none of the other two. `isRunning` is the status
        /// WORD, which is DERIVED and one of eight: a Session Argo has just typed a Turn at, or one
        /// whose process has not spoken yet, is working and does not read `running`. Each of those
        /// took the straight-send branch, so the words went down a busy PTY, no chip was drawn and
        /// the field had already cleared — submitted into the void. `hasTurnEnded` is the RELEASE,
        /// and deliberately wider still: a Turn paused on a question has not ended, but what is
        /// typed at one goes now, because the composer is the only way to answer it (#1238).
        ///
        /// Set after the init for the reason `endedByInterrupt` below is. It defaults to
        /// `isRunning`, which is the reading every fixture built before this existed meant.
        var isTurnInFlight: Bool

        /// Whether the CLI's prompt is free to take a line typed at it —
        /// `SessionStatus.takesTypedLine` (#1217). WIDER than `isRunning`: a Session blocked on a
        /// Permission or a question has no Turn to queue behind, and its keyboard still belongs to
        /// a dialog. It is what the run-settings popover draws its two knobs inert under.
        ///
        /// Set after the init for the reason `endedByInterrupt` above is: that list is at the count
        /// it is grandfathered at (`swift-boundaries` edge 6). The default is the FREE prompt,
        /// which is the state a fixture that has said nothing about this is in.
        package var takesTypedLine = true

        /// Whether the only thing holding this Session's Turn open is a delegation the parent
        /// already handed off (#1267) — `SessionComposerProjection.heldByDelegation(_:)`.
        ///
        /// Beside `isRunning` rather than instead of it, and that pair is the whole point: the
        /// status WORD still says `running`, because the record's Turn is open and the rail is
        /// still drawing a child. What this says is that none of it is the PARENT's work, which is
        /// what the footer needs to draw Send where it was drawing a Stop with nothing to stop.
        ///
        /// Set after the init for the reason `endedByInterrupt` above is.
        package var isHeldByDelegation = false

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
            self.isTurnInFlight = isRunning
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
    package static func composer(
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
        // Taken once and read twice — the placeholder below and the three readings at the foot are
        // one answer, and a field that invites a queued follow-up while send goes straight through
        // is the two disagreeing on screen.
        let isHeld = heldByDelegation(session)
        var composer = Composer(
            sessionID: session.id,
            placeholder: isHeld || !isTurnInFlight(session)
                ? placeholder(addressing: session.cli)
                : queuePlaceholder,
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
        composer.isTurnInFlight = isTurnInFlight(session)
        composer.hasTurnEnded = hasTurnEnded(session.status)
        composer.endedByInterrupt = endedByInterrupt(events)
        composer.takesTypedLine = session.status.takesTypedLine
        return isHeld ? freed(composer) : composer
    }

    /// Whether the only thing holding this Session's Turn open is a delegation the parent already
    /// handed off (#1267) — `DelegationHold` is the whole reading, and this is the one place the
    /// composer asks it.
    ///
    /// Argo's own submit is asked FIRST and outranks it. `hasUnansweredTurn` is a Turn this
    /// composer typed and the record has not answered, which is DIRECT and about the PARENT: a
    /// backgrounded child out at the same time says nothing about it.
    private static func heldByDelegation(_ session: CockpitPresentation.Session) -> Bool {
        !session.hasUnansweredTurn && session.delegationHold.holdsTurn
    }

    /// The same composer with its three Turn readings answered by the hold rather than by the
    /// status word (#1267).
    ///
    /// All three, because they are three readings of one fact and the bug is what happens when they
    /// disagree with it: a queue-only field (`isTurnInFlight`), a queue nothing will ever release
    /// (`hasTurnEnded`), and two run-settings knobs drawn inert (`takesTypedLine`). The status word
    /// itself is left alone — the record's Turn IS open, and the rail goes on saying so until the
    /// reader ends the delegation or its report arrives.
    private static func freed(_ composer: Composer) -> Composer {
        var freed = composer
        freed.isTurnInFlight = false
        freed.hasTurnEnded = true
        freed.takesTypedLine = true
        freed.isHeldByDelegation = true
        return freed
    }

    /// Whether a Turn is in flight, asked of BOTH readings that can answer (#1179).
    ///
    /// `hasUnansweredTurn` is Argo's own submit — DIRECT, and the half the status word drops
    /// wherever a drive port or a companion reports `idle` over it. The two statuses beside it are
    /// the ones a Turn can be running under with nothing yet on record to say so: `starting` is a
    /// process Argo launched that has not spoken, and `permission` is a CLI holding a prompt open
    /// that a typed line would be eaten by.
    ///
    /// `asking` is NOT here, and that is #1238's rule read at this seam rather than against it: a
    /// live question is answered THROUGH this field, so a Return queued there is an answer the
    /// agent never hears. Nor is `unknown`, which by its own definition nothing will move — a
    /// follow-up held against it would wait forever.
    private static func isTurnInFlight(_ session: CockpitPresentation.Session) -> Bool {
        if session.hasUnansweredTurn {
            return true
        }
        return switch session.status {
        case .running, .starting, .permission: true
        case .asking, .idle, .stopped, .ended, .unknown: false
        }
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
