public extension CockpitPresentation {
    /// Public so the app target can preview against it. Anything the system accent drives —
    /// the sidebar's selection capsule most of all — renders wrong in a package preview,
    /// because the `AccentColor` asset lives in the app and a package preview never sees it.
    /// Three registered Projects, the third of them somewhere it no longer is: the state the strip
    /// has to draw honestly rather than by dropping a row.
    static let previewProjects = [
        Project(id: "argo", name: "argo", location: "/Users/milad/Developer/argo"),
        Project(id: "cockpit", name: "cockpit", location: "/Users/milad/Developer/cockpit"),
        Project(
            id: "moved",
            name: "penumbra",
            location: "/Users/milad/Developer/penumbra",
            isReachable: false,
        ),
    ]

    static let preview = CockpitPresentation(
        projects: previewProjects,
        activeProjectID: "argo",
        sessions: [
            Session(
                id: "shell",
                title: "Ship the native Liquid Glass application shell "
                    + "with a deliberately long title",
                model: "claude-opus-5",
                workspaceLocation: "/Users/milad/Developer/argo",
                branch: "argo/#376-native-shell",
                access: .managed,
                status: .running,
            ),
            Session(
                id: "engine",
                title: "Port the session engine core to Swift",
                model: "codex",
                workspaceLocation: "/Users/milad/Experiments/argo",
                branch: "main",
                access: .managed,
                status: .asking,
            ),
            Session(
                id: "observed",
                title: "Review an externally launched Session",
                model: nil,
                workspaceLocation: "/Users/milad/Developer/cockpit",
                branch: nil,
                access: .readOnly,
                status: .unknown,
            ),
            Session(
                id: "idle",
                title: "Wait for the next instruction",
                model: "claude-sonnet-4",
                workspaceLocation: "/Users/milad/Developer/cockpit",
                branch: "main",
                access: .managed,
                status: .idle,
            ),
            Session(
                id: "failed",
                title: "Repair the failed native build",
                model: "codex",
                workspaceLocation: "/Users/milad/Developer/native-shell",
                branch: "argo/#377-session-roster",
                access: .managed,
                status: .stopped,
            ),
        ],
        checkout: .branch("main"),
        connection: .connected,
    )

    /// A machine that has registered nothing: no Project to name, and the checkout unavailable
    /// with it. The state first launch is in, which the chrome has to render honestly.
    static let unregisteredPreview = CockpitPresentation(
        projects: [],
        activeProjectID: nil,
        sessions: [],
        checkout: .unavailable,
        connection: .healthy,
    )

    /// The active Project's folder has moved or gone. Still a Project, and the chrome says so in
    /// words rather than dropping the name it is scoped to.
    static let unreachablePreview = CockpitPresentation(
        projects: previewProjects,
        activeProjectID: "moved",
        sessions: [],
        checkout: .unavailable,
        connection: .healthy,
    )

    static let emptyPreview = CockpitPresentation(
        projects: previewProjects,
        activeProjectID: "argo",
        sessions: [],
        checkout: .detached(shortSHA: "9011669"),
        connection: .idle,
    )
}
