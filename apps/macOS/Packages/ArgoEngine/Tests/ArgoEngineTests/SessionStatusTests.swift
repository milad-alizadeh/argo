@testable import ArgoEngine
import Foundation
import Testing

@Suite("Session status")
struct SessionStatusTests {
    @Test
    func `an open turn is running`() {
        #expect(SessionStatus.observed(turnOpen: true, lastStop: nil) == .running)
        #expect(SessionStatus.observed(turnOpen: true, lastStop: .endTurn) == .running)
    }

    @Test
    func `a closed turn reads its own reason`() {
        #expect(SessionStatus.observed(turnOpen: false, lastStop: .endTurn) == .idle)
        #expect(SessionStatus.observed(turnOpen: false, lastStop: .maxTokens) == .stopped)
        #expect(SessionStatus.observed(turnOpen: false, lastStop: .maxTurnRequests) == .stopped)
        #expect(SessionStatus.observed(turnOpen: false, lastStop: .refusal) == .stopped)
        #expect(SessionStatus.observed(turnOpen: false, lastStop: .cancelled) == .ended)
    }

    @Test
    func `nothing observed is unknown rather than idle`() {
        #expect(SessionStatus.observed(turnOpen: false, lastStop: nil) == .unknown)
    }

    @Test
    func `an unreadable reason is unknown rather than the nearest guess`() {
        #expect(StopReason(reported: "stop_sequence") == .unknown)
        #expect(SessionStatus.observed(turnOpen: false, lastStop: .unknown) == .unknown)
    }

    @Test
    func `the hosts own words are the reasons`() {
        #expect(StopReason(reported: "end_turn") == .endTurn)
        #expect(StopReason(reported: "max_tokens") == .maxTokens)
        #expect(StopReason(reported: "max_turn_requests") == .maxTurnRequests)
        #expect(StopReason(reported: "refusal") == .refusal)
        #expect(StopReason(reported: "cancelled") == .cancelled)
    }

    @Test
    func `a tool call is a pause inside a turn, never its end`() async throws {
        let events = try await Fixture.events("treeFull")

        #expect(!events.contains(.turnEnded(.unknown)))
        // The fixture's calls all carry `tool_use`; the turns that genuinely ended are the only
        // boundaries in it.
        #expect(events.contains(.turnEnded(.endTurn)))
    }

    @Test
    @MainActor
    func `a halted turn is stopped and a session with no boundary is unknown`() async throws {
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp"))
        try await hubObserveToEnd(hub, hubFixtureObservation("haltedTurn"))
        await hubObserveToEnd(hub, hubTestObservation(id: "silent", events: [.cwd("/tmp")]))

        let statuses = Dictionary(
            uniqueKeysWithValues: hub.sessions.map { ($0.id, $0.status) },
        )
        #expect(statuses["haltedTurn"] == .stopped)
        #expect(statuses["silent"] == .unknown)
    }

    @Test
    @MainActor
    func `an unclosed prompt leaves the session running`() async {
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp"))
        await hubObserveToEnd(hub, hubTestObservation(
            id: "working",
            events: [.prompt(text: "Refactor it", atMs: nil)],
        ))

        #expect(hub.sessions.first?.status == .running)
    }

    @Test
    @MainActor
    func `a session read off a transcript is external, and so read-only`() async throws {
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp"))
        try await hubObserveToEnd(hub, hubFixtureObservation("externalBasic"))

        #expect(hub.sessions.first?.provenance == .external)
    }
}
