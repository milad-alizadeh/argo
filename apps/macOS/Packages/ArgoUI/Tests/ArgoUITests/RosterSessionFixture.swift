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
        // The Session's derived name. Defaulted, because only the title suites care what it says.
        title: String? = nil,
        workspaceLocation: String? = checkout,
        kind: CockpitPresentation.Session.WorkspaceKind? = .main,
        branch: String? = "main",
        access: CockpitPresentation.Session.Access = .managed,
        entry: SessionEntry = .interactive,
        status: SessionStatus = .idle,
        lastSeenAtMs: Int? = nil,
        isArchived: Bool = false,
        explicitName: String? = nil,
        events: [TranscriptEvent] = [],
        ticket: CockpitPresentation.Session.TicketLinkReading = .unread,
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: id,
            title: title ?? "Session \(id)",
            access: access,
            status: status,
            chain: .init(
                program: .init(model: "claude-opus-5", entry: entry),
                span: .init(lastSeenAtMs: lastSeenAtMs),
            ),
            work: .init(
                location: workspaceLocation,
                workspace: kind == nil && branch == nil ? nil : .init(kind: kind, branch: branch),
                ticket: ticket,
            ),
            annotations: .init(isArchived: isArchived, explicitName: explicitName),
            transcript: .init(events: events),
        )
    }
}
