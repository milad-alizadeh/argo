import ArgoEngine
import Foundation

extension CockpitPresentation {
    /// Measured back from whenever the preview is read: a fixed stamp would age into `3y ago`
    /// on every row. Shared with the specimens, which need the same moving `now`.
    static func minutesAgo(_ minutes: Int) -> Int {
        Date().epochMs - minutes * 60 * 1000
    }
}

public extension CockpitPresentation {
    /// Public so the app target can preview against it: anything the system accent drives renders
    /// wrong in a package preview, because the `AccentColor` asset lives in the app.
    /// Three registered Projects, the third of them somewhere it no longer is; only the active
    /// Project carries a count, since the Hub observes one Project.
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
                workspaceLocation: "/Users/milad/Developer/argo/.claude/worktrees/"
                    + "ticket-376-native-shell",
                access: .managed,
                status: .running,
                cli: .claude,
                workspace: .init(
                    kind: .worktree,
                    branch: "argo/#376-native-shell",
                    dirty: 3,
                    unpushed: 1,
                ),
                // A time it will not draw: the age is suppressed by the status.
                lastSeenAtMs: minutesAgo(0),
                // A real reading off this machine, past the first line.
                contextTokens: 216_764,
                events: CockpitPresentation.Session.previewTranscript,
            ),
            Session(
                id: "engine",
                title: "Port the session engine core to Swift",
                model: "codex",
                // The Project's own checkout: the one workspace the roster draws no label for.
                workspaceLocation: "/Users/milad/Experiments/argo",
                access: .managed,
                status: .asking,
                cli: .claude,
                workspace: .init(kind: .main, branch: "main"),
                lastSeenAtMs: minutesAgo(4),
                contextTokens: 67175,
            ),
            Session(
                id: "observed",
                // Long AND read-only, deliberately — close read of ghosting is the `ghostedRows`
                // specimen.
                title: "Review an externally launched Session nobody here started",
                model: nil,
                workspaceLocation: "/Users/milad/Developer/cockpit/.claude/worktrees/"
                    + "ticket-118-replay",
                access: .external,
                // No time at all — a transcript that stamped nothing. Idle, so the absence is
                // the record's rather than the status's.
                status: .unknown,
                // A detached checkout, so there is no branch to name — the row is located anyway.
                workspace: .init(kind: .worktree),
            ),
            Session(
                id: "idle",
                title: "Wait for the next instruction",
                model: "claude-sonnet-4",
                workspaceLocation: "/Users/milad/Developer/cockpit",
                access: .managed,
                status: .idle,
                cli: .claude,
                workspace: .init(kind: .main, branch: "main", dirty: 0, unpushed: 0),
                lastSeenAtMs: minutesAgo(3 * 60),
                contextTokens: 88400,
            ),
            Session(
                id: "failed",
                title: "Repair the failed native build",
                model: "codex",
                // Long AND aged, deliberately: a real worktree name must truncate rather than
                // push the age off the line.
                workspaceLocation: "/Users/milad/Developer/argo/.claude/worktrees/"
                    + "ticket-377-session-roster-and-the-header-above-it",
                access: .managed,
                status: .stopped,
                cli: .claude,
                // The same is asked of the branch on the header above it.
                workspace: .init(
                    kind: .worktree,
                    branch: "argo/#377-session-roster-and-the-header-above-it",
                    dirty: 12,
                ),
                lastSeenAtMs: minutesAgo(2 * 24 * 60),
                // Past the second line, which is what a Session that stopped short usually is.
                contextTokens: 472_233,
            ),
        ],
        checkout: .branch("main"),
        connection: .connected,
    )

    /// Two Sessions with a reading EACH, both long enough to scroll.
    static let twoReadings = CockpitPresentation(
        projects: previewProjects,
        activeProjectID: "argo",
        sessions: [
            Session(
                id: "shell",
                title: "Ship the native Liquid Glass application shell",
                model: "claude-opus-5",
                workspaceLocation: "/Users/milad/Developer/argo",
                access: .managed,
                status: .running,
                cli: .claude,
                workspace: .init(kind: .worktree, branch: "argo/#376-native-shell"),
                contextTokens: 216_764,
                events: CockpitPresentation.Session.longTranscript,
            ),
            Session(
                id: "engine",
                title: "Port the session engine core to Swift",
                model: "codex",
                workspaceLocation: "/Users/milad/Experiments/argo",
                access: .managed,
                status: .idle,
                cli: .claude,
                workspace: .init(kind: .main, branch: "main"),
                contextTokens: 67175,
                events: CockpitPresentation.Session.longTranscript,
            ),
        ],
        checkout: .branch("main"),
        connection: .connected,
    )

    /// A machine that has registered nothing — the state first launch is in.
    static let unregisteredPreview = CockpitPresentation(
        projects: [],
        activeProjectID: nil,
        sessions: [],
        checkout: .unavailable,
        connection: .idle,
    )

    /// The active Project's folder has moved or gone. Still a Project.
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
    /// The Session a detail surface previews against, so no specimen subscripts the roster.
    static var preview: Self {
        CockpitPresentation.preview.sessions[0]
    }
}
