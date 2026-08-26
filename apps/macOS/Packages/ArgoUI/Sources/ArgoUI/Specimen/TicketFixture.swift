import ArgoEngine

/// The Sessions the ticket-title renders are drawn from (#745) — three on one ticket, one on
/// another, and one on no ticket at all.
///
/// Three on one is the case worth a render: they share a title and are told apart only by the run
/// kind on the secondary line, which is the question the ticket left open for a reviewer's eye.
enum TicketFixture {
    /// Projected through `SessionRosterProjection` exactly as the shell projects it, so a PNG is
    /// evidence about the row the app draws.
    static let rows = SessionRosterProjection.rows(from: sessions)

    /// One ticket, long enough to reach the truncation the roster column does at every width.
    private static let anchorFeed = CockpitPresentation.Session.Issue(
        number: 741, title: "Anchor the feed on its newest line, whatever the estimates said",
    )

    private static let sessions = [
        session(id: "implement", title: "/implement 741", issue: anchorFeed, status: .running),
        session(id: "review", title: "/code-review", issue: anchorFeed, minutesAgo: 12),
        session(id: "pixels", title: "/pixel-review 741", issue: anchorFeed, minutesAgo: 41),
        session(
            id: "other",
            title: "/implement 736",
            issue: .init(number: 736, title: "Draw a markdown file as the document it is"),
            minutesAgo: 3 * 60,
        ),
        // The row nothing resolved a ticket for: the derived title stands, and the run kind is NOT
        // said a second time on the line below it.
        session(id: "unlinked", title: "Have a look at what the roster is doing", minutesAgo: 90),
    ]

    private static func session(
        id: String,
        title: String,
        issue: CockpitPresentation.Session.Issue? = nil,
        status: SessionStatus = .idle,
        minutesAgo: Int? = nil,
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: id,
            title: title,
            model: nil,
            workspaceLocation: "/Users/milad/Developer/argo/.claude/worktrees/ticket-\(id)",
            access: .managed,
            status: status,
            workspace: .init(
                kind: .worktree, branch: issue.map { "argo/#\($0.number)-\(id)" } ?? "main",
            ),
            issue: issue,
            lastSeenAtMs: minutesAgo.map(CockpitPresentation.minutesAgo),
        )
    }
}
