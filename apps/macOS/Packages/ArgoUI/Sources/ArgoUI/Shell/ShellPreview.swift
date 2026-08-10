import ArgoEngine
import Foundation

extension CockpitPresentation {
    /// Measured back from whenever the preview is read: a fixed stamp would age into `3y ago`
    /// on every row. Shared with the specimens, which need the same moving `now` for the same
    /// reason and would otherwise each carry their own copy of this one line.
    static func minutesAgo(_ minutes: Int) -> Int {
        Date().epochMs - minutes * 60 * 1000
    }
}

public extension CockpitPresentation {
    /// Public so the app target can preview against it. Anything the system accent drives —
    /// the sidebar's selection capsule most of all — renders wrong in a package preview,
    /// because the `AccentColor` asset lives in the app and a package preview never sees it.
    /// Three registered Projects, the third of them somewhere it no longer is: the state the strip
    /// has to draw honestly rather than by dropping a row.
    /// Only the active Project carries a count: the Hub observes one Project, and the drawer has
    /// to be looked at with both renderings on screen at once.
    static let previewProjects = [
        Project(
            id: "argo",
            name: "argo",
            location: "/Users/milad/Developer/argo",
            liveSessionCount: 5,
        ),
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
                // A time it will not draw: the age is suppressed by the status, and a running
                // Session with none would leave that unrendered.
                lastSeenAtMs: minutesAgo(0),
                events: CockpitPresentation.Session.previewTranscript,
            ),
            Session(
                id: "engine",
                title: "Port the session engine core to Swift",
                model: "codex",
                workspaceLocation: "/Users/milad/Experiments/argo",
                branch: "main",
                access: .managed,
                status: .asking,
                lastSeenAtMs: minutesAgo(4),
            ),
            Session(
                id: "observed",
                // Long AND read-only, deliberately: whether a title still truncates cleanly on a
                // row drawn quieter than the ones around it is a rendering only a screenshot
                // settles. The close read of ghosting is the `ghostedRows` specimen.
                title: "Review an externally launched Session nobody here started",
                model: nil,
                workspaceLocation: "/Users/milad/Developer/cockpit",
                branch: nil,
                access: .external,
                // No time at all — a transcript that stamped nothing. Idle, so the absence is
                // the record's rather than the status's.
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
                lastSeenAtMs: minutesAgo(3 * 60),
            ),
            Session(
                id: "failed",
                title: "Repair the failed native build",
                model: "codex",
                workspaceLocation: "/Users/milad/Developer/native-shell",
                // Long AND aged, deliberately: whether a real branch name truncates rather than
                // pushing the age off the line is the other question only a render settles.
                branch: "argo/#377-session-roster-and-the-header-above-it",
                access: .managed,
                status: .stopped,
                lastSeenAtMs: minutesAgo(2 * 24 * 60),
            ),
        ],
        checkout: .branch("main"),
        connection: .connected,
    )

    /// Two Sessions with a reading EACH, which the roster above deliberately is not.
    ///
    /// Only one Session there carries a transcript, and a switch that lands on an empty feed
    /// settles nothing about the pane's state dying with the Session it belonged to — the empty
    /// column draws no way-back control whether the state survived or not. Both here are long
    /// enough to scroll, so the reader can leave the end of one and be shown the end of the other.
    static let twoReadings = CockpitPresentation(
        projects: previewProjects,
        activeProjectID: "argo",
        sessions: [
            Session(
                id: "shell",
                title: "Ship the native Liquid Glass application shell",
                model: "claude-opus-5",
                workspaceLocation: "/Users/milad/Developer/argo",
                branch: "argo/#376-native-shell",
                access: .managed,
                status: .running,
                events: CockpitPresentation.Session.longTranscript,
            ),
            Session(
                id: "engine",
                title: "Port the session engine core to Swift",
                model: "codex",
                workspaceLocation: "/Users/milad/Experiments/argo",
                branch: "main",
                access: .managed,
                status: .idle,
                events: CockpitPresentation.Session.longTranscript,
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
        connection: .idle,
    )

    /// The active Project's folder has moved or gone. Still a Project, and the chrome says so in
    /// words rather than dropping the name it is scoped to.
    static let unreachablePreview = CockpitPresentation(
        projects: previewProjects,
        activeProjectID: "moved",
        sessions: [],
        checkout: .unavailable,
        connection: .idle,
    )

    static let emptyPreview = CockpitPresentation(
        projects: previewProjects,
        activeProjectID: "argo",
        sessions: [],
        checkout: .detached(shortSHA: "9011669"),
        connection: .idle,
    )
}

public extension CockpitPresentation.Session {
    /// The Session a detail surface previews against, so no specimen reaches for a subscript on
    /// a roster whose order is the roster's own business.
    static var preview: Self {
        CockpitPresentation.preview.sessions[0]
    }
}
