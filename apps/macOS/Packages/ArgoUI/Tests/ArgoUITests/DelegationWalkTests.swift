import ArgoEngine
import ArgoFixtures
@testable import ArgoUI
import Testing

/// The two ways of reading a Session's delegations, pinned against each other (#1394).
///
/// The rail reads the feed's rows because it is already looking at them; the roster reads the
/// stream because building those rows once per row is about thirty times the work. They may not
/// disagree — a roster indicator that repeats #1269 repeats it on every row at once — and the only
/// thing that makes that structural is both entry points handing the same calls to one place.
@Suite("The delegation walk")
struct DelegationWalkTests {
    @Test(arguments: [DelegatingSession.running, .notRunning, .undecided])
    func `the stream and the feed's rows read the same Subagents`(of liveness: DelegatingSession) {
        let events = Self.record

        let viaRows = FeedAgents.all(in: FeedProjection.rows(from: events), of: liveness)
        let viaStream = FeedAgents.all(in: events, of: liveness, within: Self.path)

        #expect(!viaRows.isEmpty)
        #expect(viaStream.map(\.id) == viaRows.map(\.id))
        #expect(viaStream.map(\.label) == viaRows.map(\.label))
        #expect(viaStream.map(\.activity) == viaRows.map(\.activity))
        #expect(viaStream.map(\.subagentID) == viaRows.map(\.subagentID))
        #expect(FeedAgents.running(of: viaStream) == FeedAgents.running(of: viaRows))
    }

    /// The walk is forward and the outcomes are gathered as it goes, so a result that lands long
    /// after its call still answers it.
    @Test
    func `a result far from its call still answers it`() {
        let events: [TranscriptEvent] =
            [.toolCall(FeedFixture.call("away", tool: "Task", kind: .delegate, naming: "review"))]
                + (0 ..< 40).map { .message(markdown: "line \($0)") }
                + [.toolCallOutcome(TranscriptFixtures.finished("away", nil))]

        let agents = FeedAgents.all(in: events, of: .running, within: Self.path)

        #expect(agents.map(\.activity) == [.finished])
    }

    /// A backgrounded launch is answered at once by a receipt that resolves nothing, and its report
    /// lands later under the same id (#908). The later one is what decides the delegation.
    @Test
    func `the last outcome under an id is the one that decides it`() {
        let events: [TranscriptEvent] = [
            .toolCall(FeedFixture.call("away", tool: "Task", kind: .delegate, naming: "review")),
            .toolCallOutcome(ToolCallOutcome(
                id: "away",
                resolution: .init(status: .pending, result: nil, endedAtMs: nil),
                delegated: .init(usage: nil, subagentID: "child"),
            )),
            .toolCallOutcome(TranscriptFixtures.finished("away", nil)),
        ]

        #expect(
            FeedAgents.all(in: events, of: .running, within: Self.path).map(\.activity)
                == [.finished],
        )
    }

    /// Nothing but delegations: a record full of other work reads as no Subagents at all.
    @Test
    func `a Session that delegated nothing has no Subagents`() {
        let looking: [TranscriptEvent] = [
            .toolCall(FeedFixture.call("look", tool: "Read", kind: .read, naming: "a.swift")),
            .toolCallOutcome(TranscriptFixtures.finished("look", nil)),
        ]

        #expect(FeedAgents.all(in: looking, of: .running, within: Self.path).isEmpty)
    }

    private static let path = FeedPath(cwd: "/Users/milad/Developer/argo")

    /// A real record with delegations in it, so the two walks are compared over the folds that
    /// could have reached one — a survey, a gallery, a run of calls, a Turn boundary.
    private static var record: [TranscriptEvent] {
        TranscriptFixtures.longTranscript + [
            .toolCall(FeedFixture.call("open", tool: "Task", kind: .delegate, naming: "review")),
            .toolCall(FeedFixture.call("back", tool: "Task", kind: .delegate, naming: "verify")),
            .toolCallOutcome(TranscriptFixtures.finished("back", nil)),
        ]
    }
}
