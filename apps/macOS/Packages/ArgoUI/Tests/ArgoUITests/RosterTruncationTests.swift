import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// #1404: the roster stopped drawing rows partway down and left the rest of the pane blank.
struct RosterTruncationTests {
    /// Every kept Session gets a row. A roster that drops its tail is the bug.
    @Test func `every session draws A row`() {
        let sessions = (0 ..< 15).map { session(at: $0) }
        let rows = SessionRosterProjection.rows(from: sessions)
        #expect(rows.count == sessions.count)
    }

    /// The same shape the specimen reproduced the blank pane with: mixed statuses, every seventh
    /// row external.
    @Test func `every mixed session draws A row`() {
        let sessions = (0 ..< 15).map { mixedSession(at: $0) }
        let rows = SessionRosterProjection.rows(from: sessions)
        #expect(rows.count == sessions.count)
    }

    /// The whole pipeline the sidebar actually publishes through, not the projection alone.
    @Test func `the listing publishes every row`() {
        let sessions = (0 ..< 15).map { mixedSession(at: $0) }
        let listing = RosterListing()
        let reading = listing.reading(of: sessions)
        #expect(reading.rows.count == sessions.count)
    }

    private func session(at index: Int) -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "mixed-\(index)",
            title: "Session \(index + 1)",
            access: .managed,
            status: .idle,
            work: .init(
                location: "/Users/milad/Developer/argo/.claude/worktrees/ticket-\(1404 + index)",
                workspace: .init(kind: .worktree, branch: "argo/#\(1404 + index)-work"),
            ),
        )
    }

    private func mixedSession(at index: Int) -> CockpitPresentation.Session {
        let statuses: [SessionStatus] = [.running, .permission, .idle, .stopped, .unknown]
        let isExternal = index.isMultiple(of: 7)
        return CockpitPresentation.Session(
            id: "mixed-\(index)",
            title: "Session \(index + 1) — mixed roster row for #1404",
            access: isExternal ? .external : .managed,
            status: statuses[index % statuses.count],
            chain: .init(
                program: .init(cli: .claude, model: "claude-opus-5"),
                span: .init(lastSeenAtMs: Date().epochMs - index * 60 * 1000),
            ),
            work: .init(
                location: "/Users/milad/Developer/argo/.claude/worktrees/ticket-\(1404 + index)",
                workspace: .init(
                    kind: .worktree,
                    branch: "argo/#\(1404 + index)-work",
                    dirty: index % 5,
                    unpushed: index % 3,
                ),
            ),
            spend: .init(context: .held(1000 * (index + 1))),
        )
    }
}
