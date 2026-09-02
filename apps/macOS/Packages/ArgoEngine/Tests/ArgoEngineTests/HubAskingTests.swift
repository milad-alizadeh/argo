@testable import ArgoEngine
import Foundation
import Testing

/// `asking` is the one attention state an external transcript can carry, and only where "pending"
/// is confirmable from the record: the call landed and no result answered it.
@Suite("Hub asking")
@MainActor
struct HubAskingTests {
    private static let cwd = "/tmp/argo-asking"
    private static var nowMs: Int {
        Int(Date().timeIntervalSince1970 * 1000)
    }

    private static func ask(id: String) -> TranscriptEvent {
        .toolCall(ToolCall(
            id: id,
            name: ToolCall.askUserQuestion,
            kind: .other,
            target: nil,
            atMs: nowMs,
        ))
    }

    private static func answer(id: String) -> TranscriptEvent {
        .toolCallOutcome(ToolCallOutcome(
            id: id,
            resolution: ToolCallOutcome.Resolution(
                status: .completed,
                result: nil,
                endedAtMs: nowMs,
            ),
            delegated: ToolCallOutcome.Delegated(usage: nil),
        ))
    }

    @MainActor
    private static func hub(observing events: [TranscriptEvent]) async -> Hub {
        let hub = testHub(
            projectURL: URL(fileURLWithPath: cwd),
            liveness: liveProcesses(in: cwd),
        )
        await hub.refreshLiveness()
        await hubObserveToEnd(hub, hubTestObservation(id: "asking", events: [.cwd(cwd)] + events))
        return hub
    }

    @Test
    func `an unanswered question in the open turn reads asking`() async {
        let hub = await Self.hub(observing: [
            .prompt(text: "Which one?", images: [], atMs: Self.nowMs),
            Self.ask(id: "call-ask"),
        ])

        #expect(hub.sessions.first?.status == .asking)
    }

    @Test
    func `an answered question stops blocking, and the turn reads as still working`() async {
        let hub = await Self.hub(observing: [
            .prompt(text: "Which one?", images: [], atMs: Self.nowMs),
            Self.ask(id: "call-ask"),
            Self.answer(id: "call-ask"),
        ])

        #expect(hub.sessions.first?.status == .running)
    }

    @Test
    func `a question the turn it was asked in has left behind blocks nobody`() async {
        let hub = await Self.hub(observing: [
            .prompt(text: "Which one?", images: [], atMs: Self.nowMs),
            Self.ask(id: "call-ask"),
            .turnEnded(.endTurn),
        ])

        #expect(hub.sessions.first?.status == .idle)
    }

    @Test
    func `an agent's free-form question is indistinguishable from idle`() async {
        let hub = await Self.hub(observing: [
            .prompt(text: "Which one?", images: [], atMs: Self.nowMs),
            .message(markdown: "Which database should I use?"),
            .turnEnded(.endTurn),
        ])

        // Never promoted to `asking`: the record carries no structured question, and inventing one
        // would be a "come here" nobody asked for.
        #expect(hub.sessions.first?.status == .idle)
    }

    @Test
    func `the reader hands over the question the fixture leaves unanswered`() async throws {
        let events = try await Fixture.events("treeFull")
        let asks = events.compactMap { event -> String? in
            guard case let .toolCall(call) = event, call.name == ToolCall.askUserQuestion else {
                return nil
            }
            return call.id
        }
        let answered = events.compactMap { event -> String? in
            guard case let .toolCallOutcome(outcome) = event else { return nil }
            return outcome.id
        }

        #expect(asks == ["call-ask"])
        #expect(!answered.contains("call-ask"))
    }
}
