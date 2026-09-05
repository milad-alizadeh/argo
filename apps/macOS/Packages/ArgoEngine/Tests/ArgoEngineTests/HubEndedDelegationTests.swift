@testable import ArgoEngine
import Foundation
import Testing

/// A backgrounded delegation whose report never landed, and the reader ending it (#1267).
///
/// Every case runs against a SPAWNED Session, because the gesture is filed against the claim the
/// way every other drive fact is: a Session Argo cannot type at has no composer for this to give
/// back.
@Suite("Hub ended delegation")
@MainActor
struct HubEndedDelegationTests {
    /// The record the ticket is about: the agent handed work over, the host answered with a launch
    /// receipt, and the report that would have closed the call never came. Nothing after it, so the
    /// Turn stays open and the Session reads `running`.
    private static let handedOver: [TranscriptEvent] = [
        .prompt(text: "Review the diff.", images: [], atMs: 1000),
        .toolCall(ToolCall(
            id: "call-1",
            name: "Task",
            kind: .delegate,
            target: nil,
            atMs: 1100,
        )),
        .toolCallOutcome(ToolCallOutcome(
            id: "call-1",
            resolution: ToolCallOutcome.Resolution(
                status: .inProgress,
                result: nil,
                endedAtMs: 1200,
            ),
        )),
    ]

    @Test
    func `a lost report leaves the Session running until somebody says otherwise`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let session = try await Self.delegating(in: fixture)

        #expect(fixture.hub.session(id: session)?.status == .running)
        #expect(fixture.hub.session(id: session)?.delegationHold.backgrounded == ["call-1"])
    }

    @Test
    func `ending the delegation returns the Session to idle`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let session = try await Self.delegating(in: fixture)

        fixture.hub.endDelegation(callID: "call-1", for: session)

        #expect(fixture.hub.session(id: session)?.status == .idle)
    }

    /// The gesture names ONE call, and a Session with two children out is still holding one.
    @Test
    func `a second delegation still out keeps the Session running`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let session = try await Self.delegating(in: fixture, alsoHandingOver: "call-2")

        fixture.hub.endDelegation(callID: "call-1", for: session)

        #expect(fixture.hub.session(id: session)?.status == .running)

        fixture.hub.endDelegation(callID: "call-2", for: session)

        #expect(fixture.hub.session(id: session)?.status == .idle)
    }

    /// The gesture says nothing about a call the record never left open, so a Session genuinely
    /// mid-Turn is not quieted by one aimed at it.
    @Test
    func `ending a call nothing is waiting on leaves the reading alone`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let session = try await Self.delegating(in: fixture)

        fixture.hub.endDelegation(callID: "call-9", for: session)

        #expect(fixture.hub.session(id: session)?.status == .running)
    }

    /// One spawned Session with a delegation handed over and never reported on, published under the
    /// id its record names. Answers that id, which is what every act above is keyed by.
    private static func delegating(
        in fixture: SpawnFixture,
        alsoHandingOver second: String? = nil,
    ) async throws
        -> String {
        _ = try await fixture.hub.spawnSession()
        let (observation, continuation) = hubLiveObservation(at: spawnedTranscriptURL)
        await fixture.hub.startObserving(observation)
        continuation.yield([.cwd(fixture.projectURL.path)] + handedOver + handing(over: second))
        await hubSettle { fixture.hub.session(id: spawnedSessionID)?.status == .running }
        return spawnedSessionID
    }

    /// A second delegation handed over the same way, or nothing at all for the ordinary case.
    private static func handing(over callID: String?) -> [TranscriptEvent] {
        guard let callID else { return [] }
        return [
            .toolCall(ToolCall(
                id: callID,
                name: "Task",
                kind: .delegate,
                target: nil,
                atMs: 1300,
            )),
            .toolCallOutcome(ToolCallOutcome(
                id: callID,
                resolution: ToolCallOutcome.Resolution(
                    status: .inProgress,
                    result: nil,
                    endedAtMs: 1400,
                ),
            )),
        ]
    }
}
