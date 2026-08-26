import ArgoEngine

/// The Sessions the composer's cases are drawn against — one managed Claude Session, varied by the
/// one fact each case is about. Beside the specimen rather than in it: the view is a view, and a
/// catalogue of fixtures grew past the file ceiling sitting inside one.
extension ComposerSpecimen {
    /// The one fixture every composer case renders — a managed Claude Session with a model, idle
    /// enough to take the next thing typed, on an adapter that takes attachments (which Claude's
    /// is).
    static let composer = SessionComposerProjection.Composer(
        sessionID: "specimen",
        placeholder: "Message Claude Code…",
        facts: "Opus 5",
        standingAllows: [],
        isRunning: false,
        mode: .exactly(.code, cli: "acceptEdits"),
        modeDidNotTake: nil,
        lostTurn: nil,
        canAttach: true,
        canRunCommands: false,
    )

    /// The same Session on an adapter that declares no attachments (#540): no `+` on the footer at
    /// all, and the seam carrying what a drop was refused for. The absence is the state — a greyed
    /// control would invite a click and give no reason (design decision 9).
    static let noAttach = SessionComposerProjection.Composer(
        sessionID: composer.sessionID,
        placeholder: composer.placeholder,
        facts: composer.facts,
        standingAllows: [],
        isRunning: false,
        mode: composer.mode,
        modeDidNotTake: nil,
        lostTurn: nil,
        canAttach: false,
        canRunCommands: false,
    )

    /// The same Session mid-Turn: the field invites a follow-up rather than a message, and what is
    /// typed waits above it instead of going.
    static let running = SessionComposerProjection.Composer(
        sessionID: composer.sessionID,
        placeholder: SessionComposerProjection.queuePlaceholder,
        facts: composer.facts,
        standingAllows: [],
        isRunning: true,
        mode: composer.mode,
        modeDidNotTake: nil,
        lostTurn: nil,
        canAttach: true,
        canRunCommands: false,
    )

    /// The same vessel on a Session that has stopped asking about two tools (#572). Its own state
    /// because the tray is only ever seen at rest, the turn AFTER the grant.
    static let standing = SessionComposerProjection.Composer(
        sessionID: composer.sessionID,
        placeholder: composer.placeholder,
        facts: composer.facts,
        standingAllows: ["Bash", "Read"].map(StandingAllow.init(toolName:)),
        isRunning: false,
        mode: composer.mode,
        modeDidNotTake: nil,
        lostTurn: nil,
        canAttach: true,
        canRunCommands: false,
    )

    /// The same Session sitting where the ladder has no rung — `claude` in `default`, which
    /// unattended reads and nothing else, so it draws as `≈ Read Only` (#545, ADR-0025). Its own
    /// case because the `≈` and the unticked menu are the whole claim.
    static let nearly = SessionComposerProjection.Composer(
        sessionID: composer.sessionID,
        placeholder: composer.placeholder,
        facts: composer.facts,
        standingAllows: [],
        isRunning: false,
        mode: .nearly(.readOnly, cli: "default"),
        modeDidNotTake: nil,
        lostTurn: nil,
        canAttach: true,
        canRunCommands: false,
    )

    /// The same Session after a rung that did not land (#629): the picker is back on the rung the
    /// CLI reports, and the seam says which one was asked for. Its own case because the two facts
    /// only make sense together — a control that moved back with no line above it reads as a bug.
    static let modeRefused = SessionComposerProjection.Composer(
        sessionID: composer.sessionID,
        placeholder: composer.placeholder,
        facts: composer.facts,
        standingAllows: [],
        isRunning: false,
        mode: composer.mode,
        modeDidNotTake: .auto,
        lostTurn: nil,
        canAttach: true,
        canRunCommands: false,
    )

    /// The same Session in `dontAsk`, whose boundary is an allowlist Argo cannot see — so no rung
    /// is honest and the control says `unknown`.
    static let unknownMode = SessionComposerProjection.Composer(
        sessionID: composer.sessionID,
        placeholder: composer.placeholder,
        facts: composer.facts,
        standingAllows: [],
        isRunning: false,
        mode: .unknown(cli: "dontAsk"),
        modeDidNotTake: nil,
        lostTurn: nil,
        canAttach: true,
        canRunCommands: false,
    )

    /// The same Session on an adapter that DOES declare the command surface, which `claude`'s does
    /// and `codex`'s does not (#685). Every case above says `false`, so the `/` menu is a thing
    /// only the cases about it can draw — which is the honest default: a picker whose rows do
    /// nothing is worse than no picker.
    static let commands = SessionComposerProjection.Composer(
        sessionID: composer.sessionID,
        placeholder: composer.placeholder,
        facts: composer.facts,
        standingAllows: [],
        isRunning: false,
        mode: composer.mode,
        modeDidNotTake: nil,
        lostTurn: nil,
        canAttach: true,
        canRunCommands: true,
    )

    /// The same Session mid-Turn, with the command surface: the menu opens over a running Turn
    /// exactly as at rest, and coexists with a queued follow-up above the field (design decision
    /// 17, `running.png` and `queued.png`).
    static let commandsRunning = SessionComposerProjection.Composer(
        sessionID: composer.sessionID,
        placeholder: SessionComposerProjection.queuePlaceholder,
        facts: composer.facts,
        standingAllows: [],
        isRunning: true,
        mode: composer.mode,
        modeDidNotTake: nil,
        lostTurn: nil,
        canAttach: true,
        canRunCommands: true,
    )

    /// The same Session with a Workspace to name files in (#687). It declares the command surface
    /// too, because a `claude` Session has both — what the `@` cases settle is the file menu, not
    /// whether the two can coexist.
    static let mentions = SessionComposerProjection.Composer(
        sessionID: composer.sessionID,
        placeholder: composer.placeholder,
        facts: composer.facts,
        standingAllows: [],
        isRunning: false,
        mode: composer.mode,
        modeDidNotTake: nil,
        lostTurn: nil,
        canAttach: true,
        canRunCommands: true,
        resolvesMentions: true,
        workspaceRoot: WorkspaceFileFixture.root,
        touchedFiles: WorkspaceFileFixture.touched,
    )

    /// A `codex` Session: no command surface at all, and `@` present anyway (design decision 14).
    /// The claim is Argo-side — the picker turns six keystrokes into a path, and the CLI is handed
    /// the same one line either way.
    static let mentionsNoCommands = SessionComposerProjection.Composer(
        sessionID: composer.sessionID,
        placeholder: "Message Codex…",
        facts: composer.facts,
        standingAllows: [],
        isRunning: false,
        mode: composer.mode,
        modeDidNotTake: nil,
        lostTurn: nil,
        canAttach: true,
        canRunCommands: false,
        workspaceRoot: WorkspaceFileFixture.root,
        touchedFiles: WorkspaceFileFixture.touched,
    )
}
