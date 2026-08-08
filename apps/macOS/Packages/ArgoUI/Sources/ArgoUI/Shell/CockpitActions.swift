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
    ) {
        self.refreshCheckout = refreshCheckout
        self.retryConnection = retryConnection
        self.selectProject = selectProject
        self.addProject = addProject
        self.locateProject = locateProject
        self.revealProject = revealProject
        self.removeProject = removeProject
        self.spawnSession = spawnSession
    }
}
