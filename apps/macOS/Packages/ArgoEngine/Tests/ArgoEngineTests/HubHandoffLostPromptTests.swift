@testable import ArgoEngine
import Foundation
import Testing

/// Where the `/handoff` prompt goes when the CLI never takes it (#1229) — apart from the composer,
/// which is for the Turns a READER typed.
@Suite("Hub handoff lost prompt")
@MainActor
struct HubHandoffLostPromptTests {
    /// #1229's own symptom, at the seam it comes from. The reader pressed **Hand off** and got a
    /// line of Argo's words in their composer: the `/handoff` prompt, restored by the lost-Turn
    /// path as though they had typed it. They had not, and there is nothing for them to do with it.
    @Test
    func `a lost handoff prompt is filed against the handoff, never into the composer`()
        async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        _ = try await fixture.hub.spawnSession()
        await hubObserveToEnd(fixture.hub, spawnedSessionObservation(of: fixture))
        fixture.hub.handoffStarted(sessionID: spawnedSessionID)

        fixture.hub.rememberLostTurn("/handoff Write the brief", for: spawnedSessionID)

        #expect(Self.lostTurn(in: fixture.hub, sessionID: spawnedSessionID) == nil)
        #expect(fixture.hub.turnWasLost(sessionID: spawnedSessionID))
    }

    /// The reader's OWN Turn still comes back to them, handoff or no handoff: the routing above
    /// turns on who typed the words, and a Session that is not handing off has only one answer.
    @Test
    func `a lost Turn outside a handoff still goes back to the composer`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        _ = try await fixture.hub.spawnSession()
        await hubObserveToEnd(fixture.hub, spawnedSessionObservation(of: fixture))

        fixture.hub.rememberLostTurn("run the suite", for: spawnedSessionID)

        #expect(Self.lostTurn(in: fixture.hub, sessionID: spawnedSessionID) == "run the suite")
        #expect(!fixture.hub.turnWasLost(sessionID: spawnedSessionID))
    }

    /// The news is about the attempt now running and no other. A `true` left standing by a handoff
    /// that already failed would end the next one before its prompt had been written.
    @Test
    func `a fresh handoff starts with no lost prompt behind it`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        _ = try await fixture.hub.spawnSession()
        await hubObserveToEnd(fixture.hub, spawnedSessionObservation(of: fixture))
        fixture.hub.handoffStarted(sessionID: spawnedSessionID)
        fixture.hub.rememberLostTurn("/handoff Write the brief", for: spawnedSessionID)
        fixture.hub.handoffEnded(sessionID: spawnedSessionID, tookMs: 9000, failure: "unheard")

        fixture.hub.handoffStarted(sessionID: spawnedSessionID)

        #expect(!fixture.hub.turnWasLost(sessionID: spawnedSessionID))
    }

    private static func lostTurn(in hub: Hub, sessionID: String) -> String? {
        hub.sessions.first { $0.id == sessionID }?.lostTurn
    }
}
