import ArgoEngine

/// The intents the shell raises. Every one of them is performed by the app layer — a folder
/// picker, a Finder call, a registry write — so the View decides WHAT is being asked for and
/// nothing about how it happens.
public struct CockpitActions {
    public let refreshCheckout: () -> Void
    public let retryConnection: () -> Void
    /// Re-point the whole cockpit at another registered Project.
    public let selectProject: (String) -> Void
    /// Register a Project — the act that creates one, so it is the app's to run, not the drawer's.
    public let addProject: () -> Void
    /// Say where a Project's folder went, keeping the Project it already was.
    public let locateProject: (String) -> Void
    /// Show a Project's folder in Finder.
    public let revealProject: (String) -> Void
    /// Forget a Project — `ProjectRegistry.removing(id:)` is what that means.
    public let removeProject: (String) -> Void
    /// Open the Connect panel on a Project — or, with `nil`, on none, which is the state that
    /// creates one (ADR-0015).
    public let openProjectPanel: (String?) -> Void
    /// Start an agent in the active Project's folder, with Argo owning its PTY. Answers with the
    /// fresh Session's id — the claim the roster publishes its row under — and `nil` where no
    /// Session started; the app performs the spawn, the shell decides what to point at.
    public let spawnSession: () async -> String?
    /// Continue a Session Argo can no longer steer, in a fresh process on the same chain (#10).
    ///
    /// Raised by SELECTION rather than by a control, because the click is the intent: the user
    /// picked the Session in order to use it. It answers nothing — the composer appearing is the
    /// answer, and a resume that failed says so in the app's own refusal.
    public let resumeSession: (String) async -> Void
    /// Clear a Session off the roster, or put one back. The ONLY thing that ever archives one:
    /// nothing derived from a merge, a branch or a transcript reaches this, which is what makes
    /// archiving a decision rather than a status transition (#502, story 14).
    public let setSessionArchived: (String, Bool) -> Void
    /// Give a Session a name of the user's own, or — with `nil` — drop it and let the derived
    /// title come back (#502, stories 18 and 20).
    public let setSessionName: (String, String?) -> Void
    /// Hand a full Session's work to a fresh one: run `/handoff` in it, wait for the brief, and
    /// start a Session seeded with it in the same folder and against the same issue (#513).
    ///
    /// The only `async` action here, because it is the only one answered in minutes: the control
    /// that raises it holds itself for as long as it runs. The issue travels WITH the id because
    /// the engine carries no Work Item, so the view is where the link is known.
    ///
    /// Answers with the fresh Session's id, `nil` where no handoff happened — the app performs
    /// and the shell decides what to point at (`CockpitNavigationModel.session` is not public).
    public let handOffSession: (String, Int?) async -> String?
    /// Put one Turn to a Session, as though the user had typed it at that CLI's own prompt —
    /// the composer's whole intent (#538, under #535 / ADR-0024).
    ///
    /// Throwing rather than answered, and the thrown `SessionDriveError` is repeated on the
    /// composer's seam: a refusal keeps the message where it was typed, which only the raising
    /// surface can do.
    /// The attachments travel WITH the words rather than through an intent of their own: the paths
    /// are named inside the Turn the message is in (#540), so an attach that went and a send that
    /// did not would leave files written for a message nobody sent.
    public let sendTurn: (String, String, [SessionAttachment]) throws -> Void
    /// Stop the Turn a Session is running (#541) — the composer's second act on the world.
    ///
    /// Throwing, like `sendTurn` and unlike `decidePermission`, and the field is the reason. A
    /// stop that was refused stopped nothing, so nothing may be cleared behind it — and only the
    /// port knows which it was. Leaving the refusal unsaid would empty a composer on the strength
    /// of having asked, and post a line claiming a Turn was stopped that was not.
    public let interruptTurn: (String) throws -> Void
    /// Whether a Session's adapter takes attachments at all — declared, not discovered (#540). A
    /// question rather than a fact on the presentation, because the answer belongs to the drive
    /// port and the Hub's projection has never heard of it.
    public let canAttach: (String) -> Bool
    /// Answer the named Permission on a Session (#542) — `(sessionID, requestID, decision)`. The
    /// request is named because the answer must reach the prompt the user was reading and no
    /// other; the Session alone does not say that when two calls are waiting.
    ///
    /// Not throwing, unlike `sendTurn`: the one refusal — the Permission already gone — is
    /// answered by the prompt leaving the screen.
    public let decidePermission: (String, String, PermissionDecision) -> Void
    /// Put a Session on a rung of the Mode ladder (#545) — `(sessionID, mode)`. Throwing: the port
    /// refuses a rung it cannot reach from the stance it can read, and refuses one mid-Turn, and
    /// both reasons belong on the composer's seam.
    public let setSessionMode: (String, SessionMode) throws -> Void
    /// Take back a standing allow on a Session (#572) — `(sessionID, toolName)`. Keyed by tool
    /// because the tool IS the grant, and it answers no blocked call: it changes what the Session
    /// will ask about next.
    public let revokeStandingAllow: (String, String) -> Void

    /// For previews and specimens, where nothing is wired and nothing should be. `@MainActor`
    /// because every action here is called from a view.
    @MainActor public static let inert = CockpitActions(
        refreshCheckout: {},
        retryConnection: {},
        selectProject: { _ in },
        addProject: {},
        locateProject: { _ in },
        revealProject: { _ in },
        removeProject: { _ in },
        openProjectPanel: { _ in },
        spawnSession: { nil },
        resumeSession: { _ in },
        setSessionArchived: { _, _ in },
        setSessionName: { _, _ in },
        handOffSession: { _, _ in nil },
        sendTurn: { _, _, _ in },
        interruptTurn: { _ in },
        canAttach: { _ in false },
        decidePermission: { _, _, _ in },
        setSessionMode: { _, _ in },
        revokeStandingAllow: { _, _ in },
    )

    public init(
        refreshCheckout: @escaping () -> Void,
        retryConnection: @escaping () -> Void,
        selectProject: @escaping (String) -> Void,
        addProject: @escaping () -> Void,
        locateProject: @escaping (String) -> Void,
        revealProject: @escaping (String) -> Void,
        removeProject: @escaping (String) -> Void,
        openProjectPanel: @escaping (String?) -> Void,
        spawnSession: @escaping () async -> String?,
        resumeSession: @escaping (String) async -> Void = { _ in },
        setSessionArchived: @escaping (String, Bool) -> Void,
        setSessionName: @escaping (String, String?) -> Void,
        handOffSession: @escaping (String, Int?) async -> String?,
        sendTurn: @escaping (String, String, [SessionAttachment]) throws -> Void,
        interruptTurn: @escaping (String) throws -> Void = { _ in },
        canAttach: @escaping (String) -> Bool = { _ in false },
        decidePermission: @escaping (String, String, PermissionDecision) -> Void,
        setSessionMode: @escaping (String, SessionMode) throws -> Void = { _, _ in },
        revokeStandingAllow: @escaping (String, String) -> Void,
    ) {
        self.refreshCheckout = refreshCheckout
        self.retryConnection = retryConnection
        self.selectProject = selectProject
        self.addProject = addProject
        self.locateProject = locateProject
        self.revealProject = revealProject
        self.removeProject = removeProject
        self.openProjectPanel = openProjectPanel
        self.spawnSession = spawnSession
        self.resumeSession = resumeSession
        self.setSessionArchived = setSessionArchived
        self.setSessionName = setSessionName
        self.handOffSession = handOffSession
        self.sendTurn = sendTurn
        self.interruptTurn = interruptTurn
        self.canAttach = canAttach
        self.decidePermission = decidePermission
        self.setSessionMode = setSessionMode
        self.revokeStandingAllow = revokeStandingAllow
    }
}
