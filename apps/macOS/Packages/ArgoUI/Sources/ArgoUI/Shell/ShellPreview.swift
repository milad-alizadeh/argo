extension CockpitPresentation {
    static let preview = CockpitPresentation(
        project: Project(name: "argo", location: "/Users/milad/Developer/argo"),
        sessions: [
            Session(
                id: "shell",
                title: "Ship the native Liquid Glass application shell "
                    + "with a deliberately long title",
                model: "claude-opus-5",
                workspaceLocation: "/Users/milad/Developer/argo",
                branch: "argo/#376-native-shell",
                access: .managed,
                operationalState: .running,
            ),
            Session(
                id: "engine",
                title: "Port the session engine core to Swift",
                model: "codex",
                workspaceLocation: "/Users/milad/Experiments/argo",
                branch: "main",
                access: .managed,
                operationalState: .attention,
            ),
            Session(
                id: "observed",
                title: "Review an externally launched Session",
                model: nil,
                workspaceLocation: "/Users/milad/Developer/cockpit",
                branch: nil,
                access: .readOnly,
                operationalState: nil,
            ),
            Session(
                id: "idle",
                title: "Wait for the next instruction",
                model: "claude-sonnet-4",
                workspaceLocation: "/Users/milad/Developer/cockpit",
                branch: "main",
                access: .managed,
                operationalState: .idle,
            ),
            Session(
                id: "failed",
                title: "Repair the failed native build",
                model: "codex",
                workspaceLocation: "/Users/milad/Developer/native-shell",
                branch: "argo/#377-session-roster",
                access: .managed,
                operationalState: .failure,
            ),
        ],
        checkout: .branch("main"),
        connection: .healthy,
    )

    static let emptyPreview = CockpitPresentation(
        project: Project(name: "argo", location: "/Users/milad/Developer/argo"),
        sessions: [],
        checkout: .detached(shortSHA: "9011669"),
        connection: .healthy,
    )
}
