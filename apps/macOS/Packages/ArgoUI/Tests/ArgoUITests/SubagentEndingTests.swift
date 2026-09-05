import ArgoEngine
import ArgoFixtures
@testable import ArgoUI
import Testing

/// The lie the ceiling was four hours too slow to catch (#1392): four review Subagents drawn green,
/// with a clock climbing past 2h29m, over children that had each filed a report and stopped.
///
/// Nothing in the record closes a backgrounded delegation but the `task-notification` the host
/// files when the child ends, and where that is lost the call stays pending for the life of the
/// record. `DelegationCeiling` reached it eventually; `SubagentWriting` never reaches it at all,
/// because it only ever gives a running claim. What is left is the thing neither of them reads:
/// what the child itself last wrote.
///
/// The ranking those three sit in is `FeedAgents.told(_:writing:ending:at:)`, and the two suites
/// either side of this one are `FeedAgentsWritingTests` and `FeedAgentsCeilingTests`.
@Suite("Subagent ending")
struct SubagentEndingTests {
    /// The bug, in one claim. A child whose record ends on its report, with nothing writing it any
    /// more, is finished — hours inside the ceiling that used to be the only thing to reach it.
    @Test
    func `a child whose record ends on its report is finished`() {
        #expect(Self.told(Self.reported, writing: .quiet).map(\.activity) == [.finished])
    }

    /// And the host's own word for it, where the record carries one: 230 of the 575 finished
    /// Subagent records this was measured against end on a stop reason rather than on bare prose,
    /// and both readings have to land in the same place.
    @Test
    func `a child whose record carries a stop reason is finished`() {
        let stopped = Self.reported + [.turnEnded(.endTurn)]

        #expect(Self.told(stopped, writing: .quiet).map(\.activity) == [.finished])
    }

    /// A Turn somebody stopped is over too — the boundary rule the feed's own marks read
    /// (`FeedMark.endsTurn`), so the rail and the reading cannot part company on it.
    @Test
    func `a child somebody interrupted is finished`() {
        let stopped: [TranscriptEvent] = [.toolCall(Self.digging), .interrupted(atMs: nil)]

        #expect(Self.told(stopped, writing: .quiet).map(\.activity) == [.finished])
    }

    /// The other half, and the reason this is one-directional: a record that ends MID-TOOL says the
    /// child had not finished when it was written, which settles nothing about now. The chip keeps
    /// whatever the record and the parent's status left it — `unknown`, and not `finished`.
    @Test
    func `a child left mid-tool is not called finished`() {
        #expect(Self.told([.toolCall(Self.digging)], writing: .quiet).map(\.activity) == [.unknown])
    }

    /// Nor does a child Argo has no reading of at all. Absence of evidence, exactly as
    /// `SubagentWriting`'s quiet is — and reading it as an ending would quiet every delegation on a
    /// host whose Subagent records Argo never found.
    @Test
    func `a child with no reading at all is not called finished`() {
        #expect(SubagentEnding.read(nil) == .open)
        #expect(SubagentEnding.read([]) == .open)
    }

    /// A record's own bookkeeping TRAILS what it said — the prose, then the spend, then the stop
    /// reason — so the walk goes backwards to the last event that is about the work. Read forwards
    /// to the final element, every finished child would answer on its usage instead.
    @Test
    func `the reading steps over what a record notes about itself`() {
        let reported: [TranscriptEvent] = Self.reported + [
            .usage(Usage(
                inputTokens: 10,
                outputTokens: 20,
                cacheReadTokens: 0,
                cacheCreationTokens: 0,
            )),
            .model("claude-opus-5"),
        ]

        #expect(SubagentEnding.read(reported) == .stopped)
    }

    /// The ranking, and the reason it is not the other way round: the CLI splits one assistant
    /// message across a record per content block, so a live child's file passes through "ends in
    /// prose" on its way to the tool call in the same message — 4,494 such moments in the records
    /// this was measured against, half of them lasting two seconds. Growth is what tells those from
    /// an ending, so growth is asked first and this reaches a chip only once the file is quiet.
    @Test
    func `a child still writing keeps its dot whatever its record ends on`() {
        #expect(Self.told(Self.reported, writing: .writing).map(\.activity) == [.running])
    }

    /// The OTHER half of the same rule, and the one absence of evidence would break. A file Argo
    /// has never watched grow dates nothing: it is the state every child is in for the frame after
    /// its backfill, live ones included, and the CLI's split records mean a live child's backfill
    /// can END ON PROSE. Read as silence, this would quiet a Subagent mid-tool.
    @Test
    func `a child whose file was never watched grow is not quieted by its record`() {
        #expect(Self.told(Self.reported, writing: .unwatched).map(\.activity) == [.unknown])
    }

    /// A chip Argo cannot resolve to one file is decided exactly as it was before this ticket. Two
    /// files carrying one id answer nothing — `SubagentReadings` refuses both, and
    /// `SubagentReadingsTests` pins that refusal — so there is no reading here to end.
    @Test
    func `a chip with no reading to resolve is left to the facts that were already there`() {
        #expect(SubagentEnding.read(nil) == .open)
        #expect(Self.told(nil, writing: .quiet).map(\.activity) == [.unknown])
    }

    /// One-directional the other way too, exactly as `SubagentWriting` and `DelegationCeiling` are:
    /// this only ever TAKES a running claim away. A delegation the record already answered is not
    /// reopened, and one it left open is never called running on the strength of an ending.
    @Test
    func `an ending never reopens a delegation the record answered`() {
        let answered = [FeedAgent(
            id: 0,
            label: "done",
            activity: .finished,
            spend: nil,
            handover: FeedCall.Handover(subagentID: Self.child),
        )]
        let told = FeedAgents.told(
            answered,
            by: SubagentEvidence(
                writing: { _ in .quiet },
                ending: { _ in .open },
                measure: { _ in .unmeasured },
            ),
            at: Self.now,
        )

        #expect(told.map(\.activity) == [.finished])
    }

    // MARK: - Fixtures

    /// A fixed clock well inside the ceiling, so every claim above is about the ending and not
    /// about how long the suite's fixture has been waiting.
    private static let now = 1_733_000_000_000

    /// The one Subagent this suite has a reading of.
    private static let child = "a-away"

    /// The child's record as a finished one is left: a call, its result, and the report it stopped
    /// to file. The shape 332 of the 575 records this was measured against end on.
    private static let reported: [TranscriptEvent] = [
        .toolCall(digging),
        .toolCallOutcome(TranscriptFixtures.finished("dig", nil)),
        .message(markdown: "Reviewed the diff. Two findings."),
    ]

    private static let digging = FeedFixture.call("dig", tool: "Bash", kind: .execute)

    /// One backgrounded delegation, its receipt filed and no report behind it — the shape every
    /// chip in the Session this ticket was written from takes — read through the shipping seam with
    /// the child's record in hand.
    private static func told(
        _ reading: [TranscriptEvent]?,
        writing: SubagentWriting,
    )
        -> [FeedAgent] {
        FeedAgents.told(
            FeedAgents.all(in: FeedProjection.rows(from: launched), of: .undecided),
            by: SubagentEvidence(
                writing: { _ in writing },
                ending: { _ in SubagentEnding.read(reading) },
                measure: { _ in .unmeasured },
            ),
            at: now,
        )
    }

    private static let launched: [TranscriptEvent] = [
        .toolCall(FeedFixture.call("away", tool: "Agent", kind: .delegate, naming: "review")),
        .toolCallOutcome(TranscriptFixtures.launched("away", subagent: child)),
    ]
}
