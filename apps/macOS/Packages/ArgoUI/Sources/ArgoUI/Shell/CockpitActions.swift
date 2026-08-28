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
    /// Raised by selection, because the click is the intent.
    ///
    /// It answers nothing: the composer appearing is the answer, and a refusal is said by the app.
    public let resumeSession: (String) async -> Void
    /// Start an agent in the folder ANOTHER Session was running in — the act available on a Session
    /// that cannot be driven and cannot be continued either (#546). Keyed by that Session's id and
    /// not by a path, because the folder is the engine's to read: the shell knows which Session the
    /// reader is looking at and nothing about where it lives.
    ///
    /// Answers the way `spawnSession` does, and for the same reason.
    public let spawnSessionBeside: (String) async -> String?
    /// Clear a Session off the roster, or put one back. The ONLY thing that ever archives one:
    /// nothing derived from a merge, a branch or a transcript reaches this, which is what makes
    /// archiving a decision rather than a status transition (#502, story 14).
    public let setSessionArchived: (String, Bool) -> Void
    /// Give a Session a name of the user's own, or — with `nil` — drop it and let the derived
    /// title come back (#502, stories 18 and 20).
    public let setSessionName: (String, String?) -> Void
    /// Say the Turn the CLI never heard has been put back in the composer (#682), so the Hub stops
    /// reporting it. Not on the drive port: nothing is being asked of the Session — this is Argo
    /// taking back its own news, and the port is what Argo does TO an agent.
    public let clearLostTurn: (String) -> Void
    /// Hand a full Session's work to a fresh one: run `/handoff` in it, wait for the brief, and
    /// start a Session seeded with it in the same folder and against the same issue (#513).
    ///
    /// The only `async` action here, because it is the only one answered in minutes: the control
    /// that raises it holds itself for as long as it runs. The issue travels WITH the id because
    /// the engine carries no Ticket, so the view is where the link is known.
    ///
    /// Answers with the fresh Session's id, `nil` where no handoff happened — the app performs
    /// and the shell decides what to point at (`CockpitNavigationModel.session` is not public).
    public let handOffSession: (String, Int?) async -> String?
    /// Every skill installed for the active Project, read the way the CLI reads them (#685).
    ///
    /// Performed by the app layer for the reason the Project intents above are: it walks
    /// directories, and no view in `ArgoUI` may. Answered fresh on every call and nothing cached —
    /// that is what puts a skill installed mid-Session in the very next list.
    public var skills: () -> CommandCatalog = { CommandCatalog.empty }
    /// Every file in one folder's Workspace, relative to it (#687) — what the `@` picker lists.
    ///
    /// Performed by the app layer for the reason `skills` is, and `async` where that is not: it
    /// shells out to git over a tree that can hold a hundred thousand paths, and the composer
    /// must stay typeable while it lists.
    public var workspaceFiles: (String) async -> [String] = { _ in [] }
    /// What the Tickets room's row performs through a provider (#872). A value rather than two more
    /// callbacks in the list above, and outside the initialiser: these travel together, and the
    /// init is already at the cap `swift-boundaries.sh` edge 6 holds it to.
    public var tickets = Tickets()

    /// The two acts the Tickets room's row raises that reach outside the shell.
    ///
    /// Both `async` and both answered: a create answers with the refusal that stopped it, so the
    /// composer can put the provider's own words beside the button (§4); a spawn answers with the
    /// fresh Session's id, on the same terms as `spawnSession` above.
    public struct Tickets {
        /// File a ticket through `TicketWriter`. Answers `nil` where it landed, and the refusal
        /// otherwise — nothing retries, so the reply IS the outcome.
        public var createTicket: (TicketDraft) async -> TicketWriteError? = { _ in nil }
        /// Start a Session ON one ticket, on the rung the row names. The seed carries the number,
        /// which is what makes the Session claimable back (`TicketsReading.claimed`).
        public var startSession: (Int, SessionMode) async -> String? = { _, _ in nil }
    }

    /// Everything the shell asks a Session to DO, through the engine's port (ADR-0024, #633).
    /// Unlike the Project intents above, none of it is the app layer's to perform — it reaches no
    /// panel and no Finder, so there is nothing here for a closure to stand in front of.
    public let drive: any SessionDriver

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
        spawnSessionBeside: { _ in nil },
        setSessionArchived: { _, _ in },
        setSessionName: { _, _ in },
        clearLostTurn: { _ in },
        handOffSession: { _, _ in nil },
        drive: inertDriver,
    )

    /// What `inert` drives. It declares NO attachments, which is what keeps the `+` off every
    /// preview and specimen that renders a composer.
    @MainActor private static var inertDriver: InMemorySessionDriver {
        let driver = InMemorySessionDriver()
        driver.declaredSurface = DriveSurface(
            takesAttachments: false, runsCommands: true, resolvesMentions: true,
        )
        return driver
    }

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
        spawnSessionBeside: @escaping (String) async -> String? = { _ in nil },
        setSessionArchived: @escaping (String, Bool) -> Void,
        setSessionName: @escaping (String, String?) -> Void,
        clearLostTurn: @escaping (String) -> Void = { _ in },
        handOffSession: @escaping (String, Int?) async -> String?,
        drive: any SessionDriver,
        skills: @escaping () -> CommandCatalog = { CommandCatalog.empty },
        workspaceFiles: @escaping (String) async -> [String] = { _ in [] },
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
        self.spawnSessionBeside = spawnSessionBeside
        self.setSessionArchived = setSessionArchived
        self.setSessionName = setSessionName
        self.clearLostTurn = clearLostTurn
        self.handOffSession = handOffSession
        self.drive = drive
        self.skills = skills
        self.workspaceFiles = workspaceFiles
    }
}
