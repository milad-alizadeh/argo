@testable import ArgoEngine
import Testing

/// The roster is what the cockpit draws, and every claim-keyed fact now reaches it through a nested
/// `@Observable` rather than off the Hub itself (#634). That is a change of invalidation path, so
/// these state what the path has to carry: a fact landing in the ledger has to move the roster.
@Suite("Roster observation", .serialized)
@MainActor
struct RosterObservationTests {
    private func watchingSessions(_ hub: Hub) -> Tripwire {
        Tripwire.watching { _ = hub.sessions }
    }

    @Test
    func `a Permission raised on a claim moves the roster`() async throws {
        try await PermissionGate.withGate { fixture, claim, client in
            let watcher = watchingSessions(fixture.hub)

            client.sendLine(PermissionGate.bashCall)
            await settle { !fixture.hub.facts(forClaim: claim).waiting.isEmpty }

            #expect(watcher.fired)
        }
    }

    @Test
    func `a rung Argo sets moves the roster`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        let watcher = watchingSessions(fixture.hub)

        try await fixture.hub.driver.setMode(.plan, for: claim.value)

        #expect(watcher.fired)
    }

    @Test
    func `a handoff moves the roster`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        let watcher = watchingSessions(fixture.hub)

        fixture.hub.handedOff(sessionID: claim.value, to: "claim-99")

        #expect(watcher.fired)
    }
}
