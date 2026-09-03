import ArgoEngine
import ArgoFixtures
@testable import ArgoUI
import Testing

/// The lie #1089 left standing: a Session that IS running, holding delegations from a day ago whose
/// reports never landed (#1090).
///
/// `DelegatingSession` closed the case where the delegating Session had gone. It cannot reach this
/// one — the Session is running, so `session.isRunning && call.ending == .pending` was still true
/// at 33h and at 47h, and the rail drew a green dot and a clock counting up from each.
@Suite("Feed agents ceiling")
struct FeedAgentsCeilingTests {
    /// The bug, in one claim: 33 hours is not a Subagent working, it is a report that was lost.
    @Test
    func `a delegation open past the ceiling is not running`() {
        let chips = FeedAgents.all(in: Self.rows(hoursAgo: 33), of: .running, at: Self.now)

        #expect(chips.map(\.isRunning) == [false])
        #expect(FeedAgents.running(of: chips) == 0)
    }

    /// And the other half: the ceiling is not a rail gone quiet on everything old. A delegation
    /// inside it is a Subagent still out, and reads as one.
    @Test
    func `a delegation open inside the ceiling is still running`() {
        let chips = FeedAgents.all(in: Self.rows(hoursAgo: 1), of: .running, at: Self.now)

        #expect(chips.map(\.isRunning) == [true])
        #expect(FeedAgents.running(of: chips) == 1)
    }

    /// The boundary itself, from both sides — a cap nothing tests is a cap that can be edited to
    /// any number without a suite noticing. Against the constant and never against its literal:
    /// the figure has one home, and a second copy here is the drift the constant exists to stop.
    @Test
    func `a handover exactly at the ceiling has not passed it`() {
        #expect(!DelegationCeiling.passed(
            sinceMs: Self.now - DelegationCeiling.reportWindowMs,
            nowMs: Self.now,
        ))
    }

    @Test
    func `a handover one millisecond older has`() {
        #expect(DelegationCeiling.passed(
            sinceMs: Self.now - DelegationCeiling.reportWindowMs - 1,
            nowMs: Self.now,
        ))
    }

    /// One-directional, which is what keeps the ceiling from inventing a state of its own: it only
    /// ever TAKES a running claim away. A delegation the record never timestamped has no age to
    /// judge, so it is left to the two facts that were already there.
    @Test
    func `a delegation the record never timestamped is left to the other two facts`() {
        #expect(!DelegationCeiling.passed(sinceMs: nil, nowMs: Self.now))
        #expect(FeedAgents.all(in: Self.undated, of: .running, at: Self.now)
            .map(\.isRunning) == [true])
        #expect(FeedAgents.all(in: Self.undated, of: .notRunning, at: Self.now)
            .map(\.isRunning) == [false])
    }

    /// The ceiling never revives anything either. Twice, because the two are different claims: a
    /// Session that has gone stays quiet however fresh the handover ...
    @Test
    func `a fresh handover in a session that has gone is still quiet`() {
        #expect(FeedAgents.all(in: Self.rows(hoursAgo: 1), of: .notRunning, at: Self.now)
            .map(\.isRunning) == [false])
    }

    /// ... and a delegation the record ANSWERED stays landed however old it is.
    @Test
    func `a delegation the record answered stays landed however old`() {
        #expect(FeedAgents.all(in: Self.landed(hoursAgo: 33), of: .running, at: Self.now)
            .map(\.isRunning) == [false])
    }

    /// The clock goes with the dot: `AgentMeter` draws the count-up only while `isRunning`, and a
    /// backgrounded Agent reports no total to draw instead (#908). So a chip past the ceiling has
    /// nothing there rather than a `33h 07m` still ticking up.
    @Test
    func `a chip past the ceiling has nothing for the meter to draw`() throws {
        let chip = try #require(FeedAgents.all(
            in: Self.rows(hoursAgo: 33),
            of: .running,
            at: Self.now,
        )
        .first)

        #expect(!chip.isRunning)
        #expect(chip.durationMs == nil)
    }

    // MARK: - Fixtures

    /// A fixed clock, so the claims above are about the ceiling and not about when the suite ran.
    private static let now = 1_733_000_000_000

    private static func handover(_ hoursAgo: Int) -> Int {
        now - hoursAgo * 60 * 60 * 1000
    }

    /// One backgrounded delegation, its receipt filed and no report behind it — the shape of every
    /// chip this ticket was written from.
    private static func rows(hoursAgo: Int) -> [FeedRow] {
        read(atMs: handover(hoursAgo), answeredBy: launched)
    }

    /// The same delegation with its report landed, which is what the ceiling must not disturb.
    private static func landed(hoursAgo: Int) -> [FeedRow] {
        read(atMs: handover(hoursAgo), answeredBy: reported)
    }

    /// A handover on a host that stamped nothing — the one shape the ceiling makes no claim about.
    private static let undated = read(atMs: nil, answeredBy: launched)

    /// The pair every fixture here is: the delegation, and whatever answered it.
    private static func read(atMs: Int?, answeredBy outcome: ToolCallOutcome) -> [FeedRow] {
        FeedProjection.rows(from: [
            .toolCall(ToolCall(
                id: call,
                name: "Agent",
                kind: .delegate,
                target: "review",
                narration: "review",
                atMs: atMs,
            )),
            .toolCallOutcome(outcome),
        ])
    }

    private static let call = "away"
    private static let subagent = "a-away"

    /// The launch receipt, which resolves nothing (#908).
    private static let launched = TranscriptFixtures.launched(call, subagent: subagent)

    /// The report landing late, which is the one thing that closes a backgrounded delegation.
    private static let reported = ToolCallOutcome(
        id: call,
        resolution: ToolCallOutcome.Resolution(status: .completed, result: nil, endedAtMs: nil),
        delegated: ToolCallOutcome.Delegated(usage: nil, subagentID: subagent),
    )
}
