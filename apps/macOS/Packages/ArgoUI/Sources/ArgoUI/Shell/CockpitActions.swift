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
    /// Start an agent in the active Project's folder, with Argo owning its PTY. The one intent here
    /// that acts on the world rather than on Argo's own record of it.
    public let spawnSession: () -> Void
    /// Clear a Session off the roster, or put one back. The ONLY thing that ever archives one:
    /// nothing derived from a merge, a branch or a transcript reaches this, which is what makes
    /// archiving a decision rather than a status transition (#502, story 14).
    ///
    /// One intent with a direction rather than two, because it is one gesture on one row — a
    /// pair would let a surface offer the way in without the way out.
    public let setSessionArchived: (String, Bool) -> Void
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
        spawnSession: {},
        setSessionArchived: { _, _ in },
        handOffSession: { _, _ in nil },
    )

    public init(
        refreshCheckout: @escaping () -> Void,
        retryConnection: @escaping () -> Void,
        selectProject: @escaping (String) -> Void,
        addProject: @escaping () -> Void,
        locateProject: @escaping (String) -> Void,
        revealProject: @escaping (String) -> Void,
        removeProject: @escaping (String) -> Void,
        spawnSession: @escaping () -> Void,
        setSessionArchived: @escaping (String, Bool) -> Void,
        handOffSession: @escaping (String, Int?) async -> String?,
    ) {
        self.refreshCheckout = refreshCheckout
        self.retryConnection = retryConnection
        self.selectProject = selectProject
        self.addProject = addProject
        self.locateProject = locateProject
        self.revealProject = revealProject
        self.removeProject = removeProject
        self.spawnSession = spawnSession
        self.setSessionArchived = setSessionArchived
        self.handOffSession = handOffSession
    }
}
