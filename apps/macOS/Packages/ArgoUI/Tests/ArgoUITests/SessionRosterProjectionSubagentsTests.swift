import ArgoEngine
import ArgoFixtures
@testable import ArgoUI
import Testing

/// What the leading column draws for what runs under a Session — `cockpit-roster-row.md`,
/// `SubagentDots`. The core claim is rule 1: the roster's count is the rail's count, off one
/// reading, never two.
@Suite("Session roster subagents")
struct SessionRosterProjectionSubagentsTests {
    @Test
    func `a row's dot count equals the rail's own count for the same session`() {
        let events = openDelegations(3)
        let row = row(RosterSessionFixture.session(id: "s", status: .running, events: events))

        let rail = FeedAgents.running(of: FeedAgents.all(
            in: FeedProjection.rows(from: events), of: .running,
        ))

        #expect(row?.subagents == .running(rail))
        #expect(rail == 3)
    }

    @Test
    func `twelve running draws five dots and a plus seven`() {
        let row = row(RosterSessionFixture.session(
            id: "s", status: .running, events: openDelegations(12),
        ))

        #expect(row?.subagents == .running(12))
        #expect(SubagentDots.drawnDots(for: 12) == 5)
        #expect(SubagentDots.overflow(for: 12) == 7)
    }

    @Test
    func `a count at the ceiling draws no overflow`() {
        #expect(SubagentDots.drawnDots(for: 5) == 5)
        #expect(SubagentDots.overflow(for: 5) == nil)
    }

    @Test
    func `never delegated draws no mark`() {
        let row = row(RosterSessionFixture.session(id: "s", status: .running, events: []))

        #expect(row?.subagents == SessionRosterProjection.SubagentReading.none)
    }

    @Test
    func `delegated and all landed draws the dash reading`() {
        let events: [TranscriptEvent] = [
            .toolCall(FeedFixture.call("done", tool: "Task", kind: .delegate, naming: "verify")),
            .toolCallOutcome(TranscriptFixtures.finished("done", nil)),
        ]
        let row = row(RosterSessionFixture.session(id: "s", status: .running, events: events))

        #expect(row?.subagents == .landed)
    }

    @Test
    func `an open delegation argo cannot resolve draws the unresolved reading`() {
        // Idle reads `undecided` (`DelegatingSession`): the record holds a live Subagent and a
        // dead one in exactly the same shape.
        let events = openDelegations(1)
        let row = row(RosterSessionFixture.session(id: "s", status: .idle, events: events))

        #expect(row?.subagents == .unresolved)
    }

    @Test
    func `the three non-running readings are told apart`() {
        let landed = row(RosterSessionFixture.session(
            id: "landed", status: .running,
            events: [
                .toolCall(FeedFixture.call("done", tool: "Task", kind: .delegate, naming: "x")),
                .toolCallOutcome(TranscriptFixtures.finished("done", nil)),
            ],
        ))?.subagents
        let unresolved = row(RosterSessionFixture.session(
            id: "unresolved", status: .idle, events: openDelegations(1),
        ))?.subagents
        let none = row(RosterSessionFixture.session(id: "none", status: .running, events: []))?
            .subagents

        #expect(Set([landed, unresolved, none]).count == 3)
    }

    @Test
    func `an external session draws its state outline and no delegation mark`() {
        let row = row(RosterSessionFixture.session(
            id: "s", access: .external, status: .unknown, events: openDelegations(2),
        ))

        #expect(row?.state == nil)
        #expect(row?.subagents == nil)
    }

    @Test
    func `a fold sums the dots across the runs it hides, under the same ceiling`() {
        let sessions = [
            RosterSessionFixture.session(
                id: "a", workspaceLocation: "/tmp/folded", kind: nil, branch: nil,
                access: .external, entry: .headless, status: .running, events: openDelegations(2),
            ),
            RosterSessionFixture.session(
                id: "b", workspaceLocation: "/tmp/folded", kind: nil, branch: nil,
                access: .external, entry: .headless, status: .running, events: openDelegations(3),
            ),
        ]

        let rows = SessionRosterProjection.rows(from: sessions)
        let fold = rows.first { $0.fold != nil }

        #expect(fold?.subagents == .running(5))
    }

    /// `count` delegate calls, none of them answered — a Subagent still working, whatever the
    /// Session's own status settles it into.
    private func openDelegations(_ count: Int) -> [TranscriptEvent] {
        (0 ..< count).map {
            .toolCall(FeedFixture.call("away-\($0)", tool: "Task", kind: .delegate, naming: "x"))
        }
    }

    private func row(_ session: CockpitPresentation.Session) -> SessionRosterProjection.Row? {
        SessionRosterProjection.rows(from: [session]).first
    }
}
