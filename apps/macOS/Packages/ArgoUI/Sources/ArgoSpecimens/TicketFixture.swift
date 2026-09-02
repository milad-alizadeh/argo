import ArgoEngine
import ArgoUI

/// The Sessions the ticket-title renders are drawn from (#745, #1072) — three on one ticket, one
/// on another, and one on no ticket at all.
///
/// Three on one is the case worth a render: the ticket names none of them apart, so each keeps its
/// own derived title and `#741` rides the secondary line — except on the row whose title already
/// carries the number. One of the three opened on prose, which is the shape #1072 was reported
/// against. Whether three rows still read as three is what a reviewer's eye is for.
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
        session(
            id: "captions", title: "Write a caption for the prototypes folder",
            issue: anchorFeed, minutesAgo: 41,
        ),
        session(
            id: "other",
            title: "/implement 736",
            issue: .init(number: 736, title: "Draw a markdown file as the document it is"),
            minutesAgo: 3 * 60,
        ),
        // The row nothing resolved a ticket for: the derived title stands, and with no number to
        // put on the line below it that line says nothing.
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
            access: .managed,
            status: status,
            chain: .init(span: .init(lastSeenAtMs: minutesAgo.map(CockpitPresentation.minutesAgo))),
            work: .init(
                location: "/Users/milad/Developer/argo/.claude/worktrees/ticket-\(id)",
                workspace: .init(
                    kind: .worktree, branch: issue.map { "argo/#\($0.number)-\(id)" } ?? "main",
                ),
                ticket: issue.map { .linked($0) } ?? .unlinked,
            ),
        )
    }
}
