import ArgoEngine
@testable import ArgoUI

/// The Session the roster suites project from, defaulting to the plainest one there is: managed,
/// idle, in the Project's shared checkout. Each test names only the fact it is about.
///
/// Shared rather than repeated per suite, because two copies of a fixture drift into two
/// different ideas of what a default Session is, and an assertion then reads against whichever
/// one its own file happened to carry.
func rosterSession(
    id: String,
    workspaceLocation: String? = rosterMainCheckout,
    branch: String? = "main",
    access: CockpitPresentation.Session.Access = .managed,
    status: SessionStatus = .idle,
    lastSeenAtMs: Int? = nil,
)
    -> CockpitPresentation.Session {
    CockpitPresentation.Session(
        id: id,
        title: "Session \(id)",
        model: "claude-opus-5",
        workspaceLocation: workspaceLocation,
        branch: branch,
        access: access,
        status: status,
        lastSeenAtMs: lastSeenAtMs,
    )
}

/// The Project's shared checkout — the one location the roster draws nothing for.
let rosterMainCheckout = "/Users/milad/Developer/argo"
