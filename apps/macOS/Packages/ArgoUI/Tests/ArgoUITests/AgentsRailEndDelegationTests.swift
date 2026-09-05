import ArgoEngine
import ArgoFixtures
@testable import ArgoUI
import SwiftUI
import Testing

/// Ending a delegation the rail shows as running (#1267) — which chips offer the act, and what one
/// that was ended reads as afterwards.
@Suite("Agents rail end delegation")
@MainActor
struct AgentsRailEndDelegationTests {
    @Test
    func `a backgrounded delegation still out offers the act, and names its own call`() throws {
        var ended: [String] = []
        let control = Self.control { ended.append($0) }

        let end = try #require(control.end(Self.chip(activity: .running)))
        end()

        #expect(ended == [Self.call])
    }

    /// The reading the reader is most often looking at: an idle parent holding an open delegation,
    /// which `DelegatingSession` cannot settle either way (#1269).
    @Test
    func `an undecided chip offers it too — that is the chip this ticket is about`() {
        #expect(Self.control().end(Self.chip(activity: .unknown)) != nil)
    }

    /// A call the record has answered is already over, so there is nothing left to stop waiting
    /// for.
    @Test
    func `a delegation the record answered offers nothing`() {
        #expect(Self.control().end(Self.chip(activity: .finished)) == nil)
    }

    /// A SYNCHRONOUS delegation is the parent blocked inside a tool call, and ending one would take
    /// a running claim away from work that is genuinely going on. A chip the record never named
    /// reads the same way here, and for the same reason: no receipt, no id, no act.
    @Test
    func `a delegation with no launch receipt behind it offers nothing`() {
        #expect(Self.control().end(Self.chip(activity: .running, callID: nil)) == nil)
    }

    /// What the reader sees for it afterwards, and the ranking at the head of
    /// `FeedAgents.told(_:writing:ended:at:)`: the gesture is DIRECT, so it outranks the child's
    /// own file still growing.
    @Test
    func `an ended delegation reads finished, whatever its child is still doing`() {
        let told = FeedAgents.told(
            [Self.chip(activity: .running)],
            writing: { _ in .writing },
            ended: DelegationHold(backgrounded: [Self.call], isAlone: true, ended: [Self.call]),
        )

        #expect(told.map(\.activity) == [.finished])
        #expect(FeedAgents.running(of: told) == 0)
    }

    /// And a chip nobody ended is left exactly where the other two readings put it.
    @Test
    func `a delegation nobody ended keeps the reading the record and the child gave it`() {
        let told = FeedAgents.told(
            [Self.chip(activity: .running)],
            writing: { _ in .writing },
            ended: DelegationHold(backgrounded: [Self.call], isAlone: true, ended: ["another"]),
        )

        #expect(told.map(\.activity) == [.running])
    }

    /// The delegating call's own id travels onto the chip, which is what the gesture is filed
    /// under — asserted through the shipping walk rather than by building a `FeedAgent` by hand.
    @Test
    func `the rail reads the delegating call's id off the record`() throws {
        let rows = FeedProjection.rows(from: [
            .toolCall(ToolCall(
                id: Self.call,
                name: "Agent",
                kind: .delegate,
                target: "review",
                narration: "review",
                atMs: 1000,
            )),
            .toolCallOutcome(TranscriptFixtures.launched(Self.call, subagent: "a-away")),
        ])

        let chip = try #require(FeedAgents.all(in: rows, of: .running).first)

        #expect(chip.openDelegationID == Self.call)
    }

    // MARK: - Fixtures

    private static let call = "away"

    /// One chip, varied in the fact each case is about. `callID` absent is BOTH shapes the rail
    /// offers nothing for — a synchronous handover, and one the record never named — because the
    /// receipt is the whole evidence for either (`FeedCall.Handover.openDelegationID`).
    private static func chip(activity: AgentActivity, callID: String? = call) -> FeedAgent {
        FeedAgent(
            id: 0,
            label: "Spec axis review",
            activity: activity,
            spend: nil,
            handover: FeedCall.Handover(
                subagentID: "a-away",
                startedAtMs: 1000,
                openDelegationID: callID,
            ),
        )
    }

    /// A rail control with nothing but the act under test behind it.
    private static func control(
        endDelegation: @escaping @MainActor @Sendable (String) -> Void = { _ in },
    )
        -> AgentsRailControl {
        AgentsRailControl(
            scope: .constant(.session),
            isCollapsed: .constant(false),
            endDelegation: endDelegation,
        )
    }
}
