@testable import ArgoEngine
import Foundation
import Testing

/// Where the `/handoff` prompt goes when the CLI never takes it (#1229) — apart from the composer,
/// which is for the Turns a READER typed.
@Suite("Hub handoff lost prompt")
@MainActor
struct HubHandoffLostPromptTests {
    /// The words Argo steered, as the handoff's own act would type them.
    private static let prompt = "/handoff Write the handoff document to /tmp/brief.md"

    /// One spawned, observed Session with a handoff under way on it — the state all three claims
    /// below are read in.
    private func handingOff(_ fixture: SpawnFixture) async throws {
        _ = try await fixture.hub.spawnSession()
        await hubObserveToEnd(fixture.hub, spawnedSessionObservation(of: fixture))
        fixture.hub.handoffStarted(sessionID: spawnedSessionID)
        #expect(fixture.hub.steer(sessionID: spawnedSessionID, typing: Self.prompt))
    }

    /// #1229's own symptom, at the seam it comes from. The reader pressed **Hand off** and got a
    /// line of Argo's words in their composer: the `/handoff` prompt, restored by the lost-Turn
    /// path as though they had typed it. They had not, and there is nothing for them to do with it.
    @Test
    func `a lost handoff prompt is filed against the handoff, never into the composer`()
        async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        try await handingOff(fixture)

        fixture.hub.rememberLostTurn(Self.prompt, for: spawnedSessionID)

        #expect(Self.lostTurn(in: fixture.hub, sessionID: spawnedSessionID) == nil)
        #expect(fixture.hub.turnWasLost(sessionID: spawnedSessionID))
    }

    /// The reader's OWN Turn still comes back to them, handoff or no handoff.
    @Test
    func `a lost Turn outside a handoff goes back to the composer`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        _ = try await fixture.hub.spawnSession()
        await hubObserveToEnd(fixture.hub, spawnedSessionObservation(of: fixture))

        fixture.hub.rememberLostTurn("run the suite", for: spawnedSessionID)

        #expect(Self.lostTurn(in: fixture.hub, sessionID: spawnedSessionID) == "run the suite")
        #expect(!fixture.hub.turnWasLost(sessionID: spawnedSessionID))
    }

    /// Told apart by the WORDS and not by the moment. The composer stays open while a handoff runs,
    /// so a Turn the reader types goes down the same PTY and is lost the same way — and a rule that
    /// read the moment would swallow their words and abandon a handoff that was still running.
    @Test
    func `a reader's Turn lost mid-handoff is still theirs`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        try await handingOff(fixture)

        fixture.hub.rememberLostTurn("what is the branch?", for: spawnedSessionID)

        #expect(Self.lostTurn(in: fixture.hub, sessionID: spawnedSessionID)
            == "what is the branch?")
        #expect(!fixture.hub.turnWasLost(sessionID: spawnedSessionID))
    }

    /// The news is about the attempt that produced it and no other. Words or news left standing by
    /// a handoff that already failed would end the next one before its own Turn had been typed.
    @Test
    func `a handoff that ended leaves neither its words nor its news behind`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        try await handingOff(fixture)
        fixture.hub.rememberLostTurn(Self.prompt, for: spawnedSessionID)

        fixture.hub.handoffEnded(sessionID: spawnedSessionID, tookMs: 9000, failure: "unheard")

        #expect(!fixture.hub.turnWasLost(sessionID: spawnedSessionID))
        // And the same words arriving afterwards are the reader's, because nothing of Argo's is
        // standing here any more.
        fixture.hub.rememberLostTurn(Self.prompt, for: spawnedSessionID)
        #expect(Self.lostTurn(in: fixture.hub, sessionID: spawnedSessionID) == Self.prompt)
    }

    /// The whole act, whose folder half moved out of the app target with it (ADR-0022): a Session
    /// this Hub has never heard of has no folder to start one beside, and is refused before a
    /// single keystroke goes anywhere.
    @Test
    func `a handoff of a Session with no folder is refused before it types`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }

        await #expect(throws: SessionHandoff.Failure.noFolder) {
            try await fixture.hub.handOff(sessionID: "somebody-elses-session", issue: nil)
        }

        #expect(!fixture.hub.reportsHandoff(of: "somebody-elses-session"))
    }

    private static func lostTurn(in hub: Hub, sessionID: String) -> String? {
        hub.sessions.first { $0.id == sessionID }?.lostTurn
    }
}
