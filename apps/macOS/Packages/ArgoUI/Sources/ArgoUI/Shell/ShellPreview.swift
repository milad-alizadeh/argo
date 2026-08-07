extension CockpitPresentation {
    static let preview = CockpitPresentation(
        project: Project(name: "argo", location: "/Users/milad/Developer/argo"),
        sessions: [
            Session(
                id: "shell",
                title: "Ship the native Liquid Glass application shell",
                branch: "argo/#376-native-shell",
            ),
            Session(
                id: "engine",
                title: "Port the session engine core to Swift",
                branch: "main",
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
