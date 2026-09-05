@testable import ArgoEngine
import Foundation
import Testing

/// The ways one handoff ends badly, apart from the suite that asserts the ORDER its acts go in: a
/// prompt the CLI never took (#1229), a brief that arrived behind one, and a spawn that refused
/// after the brief had landed.
@Suite("Session handoff refusals")
@MainActor
struct SessionHandoffRefusalTests {
    /// The wait is twenty minutes long because `/handoff` is a whole Turn of real work. A Turn the
    /// CLI never took is not work in progress, so waiting the full limit for it reports a hang as
    /// patience (#1229).
    @Test
    func `a prompt the CLI never took ends the handoff at once`() async throws {
        let fixture = HandoffFixture(patience: HandoffPatience(pollMs: 100, limitMs: 300))
        defer { fixture.remove() }
        fixture.host.handoffTurnLost = true

        await #expect(throws: SessionHandoff.Failure.promptNeverSubmitted) {
            try await fixture.handoff.run(fixture.request)
        }

        // Before the first pause: the limit is never reached, so the ending cannot be the timeout
        // wearing this failure's name.
        let ended = try #require(fixture.host.ended.first)
        #expect(ended.tookMs == 0)
        #expect(fixture.host.seeds.isEmpty)
    }

    /// The brief is the CLI's own answer and it outranks the watch: a Turn that produced one was
    /// taken, whatever a screen read three seconds after it was typed said about the composer.
    @Test
    func `a brief that arrived outranks a Turn reported lost behind it`() async throws {
        let fixture = HandoffFixture(patience: HandoffPatience(pollMs: 100, limitMs: 300))
        defer { fixture.remove() }
        fixture.host.onPause = {
            fixture.writeBriefOnce()
            fixture.host.handoffTurnLost = true
        }

        let outcome = try await fixture.handoff.run(fixture.request)

        #expect(outcome.sessionID == "fresh-session")
    }

    /// The row is the report now (#1229), so what it carries has to be a sentence: a spawn refusal
    /// reaching the reading as an enum's own description is the one failure nobody can act on.
    @Test
    func `a spawn refusal ends the handoff in Argo's own words`() async throws {
        let fixture = HandoffFixture()
        defer { fixture.remove() }
        fixture.host.onPause = { fixture.writeBriefOnce() }
        fixture.host.spawnFailure = .executableNotFound(command: "claude")

        await #expect(throws: AgentSpawnError.executableNotFound(command: "claude")) {
            try await fixture.handoff.run(fixture.request)
        }

        let ended = try #require(fixture.host.ended.first)
        #expect(ended.failure == AgentSpawnError.executableNotFound(command: "claude").detail)
    }
}
