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
    /// creates one (ADR-0015). One intent for both, because they are one surface: Project Settings
    /// IS this panel re-entered, and a pair would let a machine with nothing registered reach the
    /// half that needs a Project and not the half that makes one.
    ///
    /// Named for the panel rather than for "settings" in general, because there is no app-global
    /// settings surface to be confused with.
    public let openProjectPanel: (String?) -> Void
    /// Start an agent in the active Project's folder, with Argo owning its PTY. The one intent here
    /// that acts on the world rather than on Argo's own record of it.
    ///
    /// It ANSWERS with the fresh Session's id — the claim the roster publishes its row under — and
    /// `nil` where no Session started. The selection is the shell's own business for the reason
    /// `handOffSession` is: the app performs the spawn, the shell decides what to point at.
    public let spawnSession: () async -> String?
    /// Clear a Session off the roster, or put one back. The ONLY thing that ever archives one:
    /// nothing derived from a merge, a branch or a transcript reaches this, which is what makes
    /// archiving a decision rather than a status transition (#502, story 14).
    ///
    /// One intent with a direction rather than two, because it is one gesture on one row — a
    /// pair would let a surface offer the way in without the way out.
    public let setSessionArchived: (String, Bool) -> Void
    /// Give a Session a name of the user's own, or — with `nil` — drop it and let the derived
    /// title come back (#502, stories 18 and 20).
    ///
    /// One intent with a nullable name rather than a rename and a reset, for the reason archiving
    /// is one intent with a direction: resetting is not a second decision, it is this one unmade,
    /// and a pair would let a surface offer the way in without the way out.
    public let setSessionName: (String, String?) -> Void
    /// Hand a full Session's work to a fresh one: run `/handoff` in it, wait for the brief, and
    /// start a Session seeded with it in the same folder and against the same issue (#513).
    ///
    /// One intent and not three, deliberately — the sequence is `SessionHandoff`'s, and a view that
    /// could raise the three halves separately could raise the third without the first.
    ///
    /// The only `async` action here, because it is the only one answered in minutes: the control
    /// that raises it has to hold itself for as long as it runs, and a fire-and-forget closure
    /// gives it nothing to hold itself against. The issue travels WITH the id because the view is
    /// where the link is known — the engine carries no Work Item today, so a fresh Session would
    /// otherwise open against no intent at all.
    ///
    /// It ANSWERS with the fresh Session's id, and `nil` where no handoff happened. The selection
    /// is the shell's own business (`CockpitNavigationModel.session` is deliberately not public),
    /// so the app performs the handoff and the shell decides what to point at.
    public let handOffSession: (String, Int?) async -> String?
    /// Put one Turn to a Session, as though the user had typed it at that CLI's own prompt —
    /// the composer's whole intent (#538, under #535 / ADR-0024).
    ///
    /// Throwing rather than answered, and the thrown `SessionDriveError` is repeated on the
    /// composer's seam: a refusal keeps the message where it was typed, which only the raising
    /// surface can do.
    public let sendTurn: (String, String) throws -> Void
    /// Answer the named Permission on a Session (#542) — `(sessionID, requestID, decision)`. The
    /// request is named because the answer must reach the prompt the user was reading and no
    /// other; the Session alone does not say that when two calls are waiting.
    ///
    /// Not throwing, unlike `sendTurn`: the one refusal — the Permission already gone — is
    /// answered by the prompt leaving the screen, and there is no field holding words that need a
    /// seam to explain them.
    public let decidePermission: (String, String, PermissionDecision) -> Void
    /// Take back a standing allow on a Session (#572) — `(sessionID, toolName)`. Keyed by tool
    /// because the tool IS the grant.
    ///
    /// Its own intent rather than a fourth `PermissionDecision`, because the two are not the same
    /// gesture: a decision answers a call the agent is blocked on, and this answers nothing — it
    /// changes what the Session will ask about next.
    public let revokeStandingAllow: (String, String) -> Void

    /// For previews and specimens, where nothing is wired and nothing should be. `@MainActor` for
    /// the same reason every action here is: they are called from a view.
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
        setSessionArchived: { _, _ in },
        setSessionName: { _, _ in },
        handOffSession: { _, _ in nil },
        sendTurn: { _, _ in },
        decidePermission: { _, _, _ in },
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
        setSessionArchived: @escaping (String, Bool) -> Void,
        setSessionName: @escaping (String, String?) -> Void,
        handOffSession: @escaping (String, Int?) async -> String?,
        sendTurn: @escaping (String, String) throws -> Void,
        decidePermission: @escaping (String, String, PermissionDecision) -> Void,
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
        self.setSessionArchived = setSessionArchived
        self.setSessionName = setSessionName
        self.handOffSession = handOffSession
        self.sendTurn = sendTurn
        self.decidePermission = decidePermission
        self.revokeStandingAllow = revokeStandingAllow
    }
}
