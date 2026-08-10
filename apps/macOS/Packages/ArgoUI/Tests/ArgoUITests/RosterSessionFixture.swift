import ArgoEngine
@testable import ArgoUI

/// The Session the roster suites project from, defaulting to the plainest one there is: managed,
/// idle, in the Project's own checkout. Each test names only the fact it is about.
///
/// Shared rather than repeated per suite, because two copies of a fixture drift into two
/// different ideas of what a default Session is, and an assertion then reads against whichever
/// one its own file happened to carry.
enum RosterSessionFixture {
    /// The Project's own checkout — the one location the roster draws nothing for.
    static let checkout = "/Users/milad/Developer/argo"

    static func session(
        id: String,
        workspaceLocation: String? = checkout,
        kind: CockpitPresentation.Session.WorkspaceKind? = .main,
        branch: String? = "main",
        access: CockpitPresentation.Session.Access = .managed,
        status: SessionStatus = .idle,
        lastSeenAtMs: Int? = nil,
        isArchived: Bool = false,
        explicitName: String? = nil,
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: id,
            title: "Session \(id)",
            model: "claude-opus-5",
            workspaceLocation: workspaceLocation,
            access: access,
            status: status,
            workspace: kind == nil && branch == nil ? nil : .init(kind: kind, branch: branch),
            lastSeenAtMs: lastSeenAtMs,
            isArchived: isArchived,
            explicitName: explicitName,
        )
    }
}
