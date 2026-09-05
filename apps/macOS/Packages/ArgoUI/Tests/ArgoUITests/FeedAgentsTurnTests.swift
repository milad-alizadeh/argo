import ArgoEngine
import ArgoFixtures
@testable import ArgoUI
import Testing

/// The rail opening for a second on a Turn that delegated nothing (#1277).
///
/// A pending delegation the record never closed is the standing shape of #1076, and while the
/// Session was idle `DelegatingSession` kept it quiet. Sending a Turn made the Session read
/// `running`, and every one of those leftovers counted again at once — so the rail was reporting a
/// status change on the PARENT rather than any work that was happening.
///
/// The evidence that settles it is in the record and is the delegation's own: the Turn it was
/// handed over in has ENDED. A synchronous delegation cannot outlive the Turn that blocked on it,
/// and a backgrounded one that outlives its Turn is decided by the child's own file
/// (`FeedAgents.told(_:writing:at:)`), which this leaves untouched.
@Suite("Feed agents turn")
struct FeedAgentsTurnTests {
    /// The bug, in one claim: the leftovers of a Turn that is over are not this Turn's work.
    @Test
    func `a delegation from a turn the record closed is not running`() {
        let chips = FeedAgents.all(in: Self.rows(Self.leftOver), of: .running)

        #expect(chips.map(\.activity) == [.unknown])
        #expect(FeedAgents.running(of: chips) == 0)
    }

    /// The acceptance criterion, as the reader meets it: a Session holding stale pending calls is
    /// sent a prompt, its status flips to `running`, and the count line does not move.
    @Test
    func `sending a turn at stale pending calls does not move the count`() {
        let idle = FeedAgents.all(in: Self.rows(Self.leftOver), of: .undecided)
        let sent = FeedAgents.all(in: Self.rows(Self.leftOver + Self.asked), of: .running)

        #expect(FeedAgents.running(of: idle) == 0)
        #expect(FeedAgents.running(of: sent) == FeedAgents.running(of: idle))
        #expect(sent.map(\.activity) == [.unknown])
    }

    /// And the other half: this is not a rail that went quiet for good. A delegation handed over in
    /// the Turn that is STILL open is this Turn's work, and reads as one.
    @Test
    func `a delegation in the turn still open is running`() {
        let chips = FeedAgents.all(
            in: Self.rows(Self.leftOver + Self.asked + Self.away),
            of: .running,
        )

        #expect(chips.map(\.activity) == [.unknown, .running])
        #expect(FeedAgents.running(of: chips) == 1)
    }

    /// Stop is a Turn boundary too (`FeedMark.endsTurn`): a delegation somebody interrupted is as
    /// over as one the agent finished, and the next Turn must not count it either.
    @Test
    func `a delegation from an interrupted turn is not running`() {
        let chips = FeedAgents.all(in: Self.rows(Self.handedOver + Self.stopped), of: .running)

        #expect(FeedAgents.running(of: chips) == 0)
    }

    /// One-directional, exactly as `DelegationCeiling` and `SubagentWriting` are: this only ever
    /// TAKES a running claim off the parent's status. The child's OWN file still gives it back, and
    /// that is what keeps a backgrounded Subagent — which outlives its Turn by design — visible
    /// (#1269).
    @Test
    func `a child still writing keeps its dot across the turn boundary`() {
        let chips = FeedAgents.all(in: Self.rows(Self.leftOver), of: .running)
        let told = FeedAgents.told(chips, writing: { _ in .writing }, at: Self.now)

        #expect(told.map(\.activity) == [.running])
    }

    /// A Session that has GONE is still quiet whatever Turn the delegation sat in — the ruling this
    /// reaches is the running one, and #1076's is untouched.
    @Test
    func `a delegation from a closed turn in a session that has gone is still finished`() {
        #expect(FeedAgents.all(in: Self.rows(Self.leftOver), of: .notRunning)
            .map(\.activity) == [.finished])
    }

    /// The roster reads the same delegations off the STREAM (#1394), so it has to reach the same
    /// ruling on both boundaries: two readings of one question is the disagreement #1269 was
    /// written for.
    @Test
    func `the stream reads a closed turn the same way the rows do`() {
        for closed in [Self.leftOver, Self.handedOver + Self.stopped] {
            let off = FeedAgents.all(in: closed, of: .running, within: .anywhere)

            #expect(off.map(\.activity) == [.unknown])
            #expect(FeedAgents.all(in: Self.rows(closed), of: .running)
                .map(\.activity) == [.unknown])
        }
    }

    // MARK: - Fixtures

    private static let now = 1_733_000_000_000

    /// The delegation and its launch receipt, which resolves nothing (#908) — the pending call the
    /// record will never close.
    private static let handedOver: [TranscriptEvent] = [
        .toolCall(ToolCall(
            id: "away",
            name: "Agent",
            kind: .delegate,
            target: "review",
            narration: "review",
            atMs: now,
        )),
        .toolCallOutcome(TranscriptFixtures.launched("away", subagent: "a-away")),
    ]

    /// That call, in a Turn the record has since closed.
    private static let leftOver: [TranscriptEvent] = handedOver + [.turnEnded(.endTurn)]

    /// The other boundary: somebody pressed Stop (#1189).
    private static let stopped: [TranscriptEvent] = [.interrupted(atMs: nil)]

    /// Somebody typing the next prompt — the moment the Session reads `running` again.
    private static let asked: [TranscriptEvent] = [
        .prompt(text: "Write the tests.", images: [], atMs: now),
    ]

    /// A second delegation, handed over by the Turn that is open.
    private static let away: [TranscriptEvent] = [
        .toolCall(ToolCall(
            id: "out",
            name: "Agent",
            kind: .delegate,
            target: "build",
            narration: "build",
            atMs: now,
        )),
    ]

    private static func rows(_ events: [TranscriptEvent]) -> [FeedRow] {
        FeedProjection.rows(from: events)
    }
}
