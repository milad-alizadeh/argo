@testable import ArgoEngine
import Foundation
import Testing

/// The process behind a spawned row: a host that refuses to start one, a PTY lost under a live
/// Session, one that dies before the CLI ever wrote a record, and Argo ending every PTY it holds.
///
/// The ROW — what the spawn publishes and what the record turns it into — is `HubSpawnTests`.
@Suite("Hub spawn process")
@MainActor
struct HubSpawnProcessTests {
    @Test
    func `a spawn the host refuses publishes no row and keeps no claim`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        fixture.host.refusal = .hostRefused(detail: "no pty")

        await #expect(throws: AgentSpawnError.hostRefused(detail: "no pty")) {
            try await fixture.hub.spawnSession()
        }

        #expect(fixture.hub.sessions.isEmpty)
        // The claim is released.
        #expect(fixture.hub.ownership.liveClaims.isEmpty)
    }

    @Test
    func `a Hub with no process host cannot spawn`() async {
        let hub = testHub(projectURL: URL(fileURLWithPath: "/tmp"))

        await #expect(throws: AgentSpawnError.self) {
            try await hub.spawnSession()
        }
    }

    @Test
    func `losing the PTY demotes the Session to orphaned`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        _ = try await fixture.hub.spawnSession()
        await hubObserveToEnd(fixture.hub, fixture.observedSpawn())
        #expect(fixture.hub.sessions.map(\.provenance) == [.managed])

        fixture.host.endLastProcess(exitCode: 0)

        // Observation survives the PTY; steering does not, and neither does `managed`.
        #expect(fixture.hub.sessions.map(\.provenance) == [.orphaned])
        #expect(fixture.hub.ownership.ownerOf(sessionID: "session-from-cli") == nil)
        #expect(fixture.hub.terminals.attach(to: .init(value: "claim-1")) { _ in } == nil)
    }

    /// The one row no observation can reach: the CLI never wrote a record, so no sweep corrects it.
    @Test
    func `a spawn whose PTY dies before any record says so and ends`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        _ = try await fixture.hub.spawnSession()

        fixture.host.endLastProcess(exitCode: 127)

        #expect(fixture.hub.sessions.map(\.title) == ["claude exited (code 127)"])
        #expect(fixture.hub.sessions.map(\.provenance) == [.orphaned])
        #expect(fixture.hub.sessions.map(\.status) == [.ended])
    }

    @Test
    func `ending owned Sessions kills every PTY and closes every claim`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        _ = try await fixture.hub.spawnSession()
        _ = try await fixture.hub.spawnSession()

        fixture.hub.endOwnedSessions()

        #expect(fixture.host.started.filter(\.isTerminated).count == 2)
        #expect(fixture.hub.ownership.liveClaims.isEmpty)
    }
}
