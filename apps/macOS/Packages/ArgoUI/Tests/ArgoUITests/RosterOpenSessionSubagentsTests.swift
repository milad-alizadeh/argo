import ArgoEngine
import ArgoFixtures
@testable import ArgoUI
import Testing

/// Rule 1 for the row the DECK HAS OPEN: two surfaces, one second, one answer (#1513).
///
/// The roster walks three of the rail's four facts off the Session's own stream, because the
/// fourth — each Subagent's file, growing — is one Argo holds for the open Session alone
/// (`Hub.subagentGrewAtMs`, #1394). That leaves every other row honestly `.unresolved`. It may not
/// leave THIS one there: the fourth fact is in hand for exactly this Session, and the deck beside
/// the row is already drawing it.
///
/// The state under test is the reported one: a parent that delegated its fan-out and now waits
/// reads `idle`, `DelegatingSession.of(.idle)` is `.undecided`, and an undecided delegation
/// resolves to `.unknown` — grey — while the children go on writing.
@Suite("Roster subagents for the open Session")
@MainActor
struct RosterOpenSessionSubagentsTests {
    private static let writing = ["a-0", "a-1"]

    @Test
    func `the open row draws the rail's own running count`() {
        let session = Self.waiting(delegating: Self.writing)
        let reader = Self.reader(writing: Self.writing)

        let rail = FeedAgents.running(of: reader.agents(
            in: FeedProjection.rows(from: session.events),
        ))
        let row = Self.row(of: session, opened: session.id, asking: reader)

        #expect(rail == 2)
        #expect(row?.subagents == .running(rail))
    }

    @Test
    func `a row the deck has not opened keeps the unresolved reading`() {
        let session = Self.waiting(delegating: Self.writing)
        let row = Self.row(of: session, opened: "somebody-else", asking: Self.reader(
            writing: Self.writing,
        ))

        #expect(row?.subagents == .unresolved)
    }

    /// The fourth fact does not INVENT a running Subagent: a child Argo has watched fall silent
    /// past its ceiling is still landed, open row or not.
    @Test
    func `the open row still reads the three facts where the fourth says nothing`() {
        let session = Self.waiting(delegating: Self.writing)
        let row = Self.row(of: session, opened: session.id, asking: FeedAgentReader(
            events: Self.readings(of: Self.writing),
            of: .undecided,
            growth: StatedGrowth(silent: Set(Self.writing)),
        ))

        #expect(row?.subagents == .unresolved)
    }

    /// Rule 9 for a fold: its pooled count follows the same rule for the run it hides that is open.
    @Test
    func `a fold pools the open run's running dots`() {
        let sessions = (0 ..< 2).map { position in
            RosterSessionFixture.session(
                id: "run-\(position)", workspaceLocation: "/tmp/folded", kind: nil, branch: nil,
                access: .external, entry: .headless, status: .idle,
                events: Self.delegations(["\(position)-a", "\(position)-b"]),
            )
        }
        let reader = FeedAgentReader(
            events: Self.readings(of: ["1-a", "1-b"]),
            of: .undecided,
            growth: StatedGrowth(writing: ["1-a", "1-b"]),
        )
        let rows = SessionRosterProjection.rows(
            from: sessions,
            focus: SessionRosterProjection.focus(
                on: "run-1", among: sessions, asking: reader,
            ),
        )

        #expect(rows.first { $0.fold != nil }?.subagents == .running(2))
    }

    /// A Session whose fan-out is away and whose own Turn has closed — the reported state.
    private static func waiting(delegating children: [String]) -> CockpitPresentation.Session {
        RosterSessionFixture.session(id: "open", status: .idle, events: delegations(children))
    }

    /// One backgrounded delegation per child, each answered by the launch receipt that names it
    /// and resolves nothing (#908) — which is what gives the row a Subagent ID to ask about.
    private static func delegations(_ children: [String]) -> [TranscriptEvent] {
        children.flatMap { child -> [TranscriptEvent] in
            [
                .toolCall(FeedFixture.call(
                    "away-\(child)", tool: "Task", kind: .delegate, naming: "verify",
                )),
                .toolCallOutcome(TranscriptFixtures.launched("away-\(child)", subagent: child)),
            ]
        }
    }

    private static func reader(writing children: [String]) -> FeedAgentReader {
        FeedAgentReader(
            events: readings(of: children),
            of: .undecided,
            growth: StatedGrowth(writing: Set(children)),
        )
    }

    /// A record per child, so the reader has one to date. Empty on purpose: what the roster asks
    /// of it is whether the file GREW, which the fixture states beside it.
    private static func readings(of children: [String]) -> [String: [TranscriptEvent]] {
        Dictionary(uniqueKeysWithValues: children.map { ($0, []) })
    }

    private static func row(
        of session: CockpitPresentation.Session, opened: String, asking reader: FeedAgentReader,
    )
        -> SessionRosterProjection.Row? {
        SessionRosterProjection.rows(
            from: [session],
            focus: SessionRosterProjection.focus(
                on: opened, among: [session], asking: reader,
            ),
        ).first
    }
}
