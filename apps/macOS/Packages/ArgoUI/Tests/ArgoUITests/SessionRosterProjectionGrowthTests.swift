import ArgoEngine
import ArgoFixtures
@testable import ArgoUI
import Foundation
import Testing

/// The fourth fact reaching the roster (#1572) — `cockpit-roster-row.md` rule 1 for the rows the
/// three-fact reading could not answer.
///
/// Its own suite because the claims are its own: the cases beside it in
/// `SessionRosterProjectionSubagentsTests` are about what the RECORD settles, and every one of them
/// holds unchanged. These are about what the record cannot, and what may override it.
@Suite("Session roster subagent growth")
struct SessionRosterProjectionGrowthTests {
    @Test
    func `an idle parent does not silence a child argo has watched grow`() {
        // The reported state: a parent that delegated its whole fan-out and is now waiting on it,
        // so it writes nothing and reads `idle` while its children work (#1572).
        let events = backgroundedDelegations(2)
        let quiet = row(session(status: .idle, events: events))
        let watched = row(
            session(status: .idle, events: events), watching: growing(2),
        )

        #expect(quiet?.subagents == .unresolved)
        #expect(watched?.subagents == .running(2))
    }

    @Test
    func `a watched row draws the rail's own count, and an unwatched one cannot`() {
        let events = backgroundedDelegations(2)
        let growth = growing(2)
        let row = row(session(status: .idle, events: events), watching: growth)

        // The rail's four-fact reading of the same record, off the same `told` step.
        let rail = FeedAgents.running(of: growth.told(
            FeedAgents.all(in: FeedProjection.rows(.justTheStream(events)), of: .undecided),
            at: nowMs,
        ))

        #expect(row?.subagents == .running(rail))
        #expect(rail == 2)
    }

    /// The projection above is not the surface the sidebar calls. This is (`ShellSidebar`), and a
    /// row published through it that loses the growth is the reported bug back.
    @Test
    @MainActor
    func `the listing the sidebar publishes through carries the growth`() {
        let sessions = [session(status: .idle, events: backgroundedDelegations(2))]

        let quiet = RosterListing().reading(of: sessions, now: now)
        let watched = RosterListing().reading(of: sessions, watching: growing(2), now: now)

        #expect(quiet.rows.first?.subagents == .unresolved)
        #expect(watched.rows.first?.subagents == .running(2))
    }

    @Test
    func `a fold pools the dots its watched runs are drawing`() {
        let sessions = (0 ..< 2).map { index in
            session(
                id: "f-\(index)",
                workspaceLocation: "/tmp/folded",
                status: .idle,
                events: backgroundedDelegations(1, from: index),
            )
        }

        let rows = SessionRosterProjection.rows(
            from: sessions, watching: growing(2), now: now,
        )

        #expect(rows.first { $0.fold != nil }?.subagents == .running(2))
    }

    @Test
    func `growth never reopens a delegation the record answered`() {
        // One-directional, as `SubagentWriting` states: a trailing byte in a child's file does not
        // un-answer an ending the parent's own record holds.
        let events: [TranscriptEvent] = [
            .toolCall(FeedFixture.call("done", tool: "Task", kind: .delegate, naming: "verify")),
            .toolCallOutcome(TranscriptFixtures.finished("done", nil)),
        ]
        let row = row(session(status: .idle, events: events), watching: growing(2))

        #expect(row?.subagents == .landed)
    }

    /// The moment every reading here is taken at, and the moment `growing(_:)` dates its writes to
    /// — one constant so no assertion depends on the wall clock.
    private let now = Date(timeIntervalSince1970: 1_733_000_000)

    private var nowMs: Int {
        now.epochMs
    }

    /// `count` Subagents Argo watched write just now — the fourth fact, keyed by the ids
    /// `backgroundedDelegations` names.
    private func growing(_ count: Int) -> SubagentGrowth {
        SubagentGrowth(lastGrewAtMs: Dictionary(
            uniqueKeysWithValues: (0 ..< count).map { ("child-\($0)", nowMs) },
        ))
    }

    /// `count` BACKGROUNDED delegations: each handed over and answered by the launch receipt that
    /// resolves nothing (#908), which is what names the child and leaves the call pending. A
    /// delegation with no receipt names no Subagent, so no evidence could reach it.
    private func backgroundedDelegations(_ count: Int, from first: Int = 0) -> [TranscriptEvent] {
        (first ..< first + count).flatMap { index -> [TranscriptEvent] in
            [
                .toolCall(ToolCall(
                    id: "away-\(index)", name: "Task", kind: .delegate, target: "x",
                    narration: "x", atMs: nowMs - 60000,
                )),
                .toolCallOutcome(TranscriptFixtures.launched(
                    "away-\(index)", subagent: "child-\(index)",
                )),
            ]
        }
    }

    private func session(
        id: String = "s",
        workspaceLocation: String? = nil,
        status: SessionStatus,
        events: [TranscriptEvent],
    )
        -> CockpitPresentation.Session {
        guard let workspaceLocation else {
            return RosterSessionFixture.session(id: id, status: status, events: events)
        }
        return RosterSessionFixture.session(
            id: id, workspaceLocation: workspaceLocation, kind: nil, branch: nil,
            access: .external, entry: .headless, status: status, events: events,
        )
    }

    /// Defaulted, so a case that passes nothing is asking for the THREE-fact reading exactly as it
    /// shipped — which is half of what the first case here compares.
    private func row(
        _ session: CockpitPresentation.Session, watching growth: SubagentGrowth = .unwatched,
    )
        -> SessionRosterProjection.Row? {
        SessionRosterProjection.rows(from: [session], watching: growth, now: now).first
    }
}
