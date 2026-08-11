@testable import ArgoEngine
import Observation
import Synchronization
import Testing

/// The roster is what the cockpit draws, and every claim-keyed fact now reaches it through a nested
/// `@Observable` rather than off the Hub itself (#634). That is a change of invalidation path, so
/// these state what the path has to carry: a fact landing in the ledger has to move the roster.
@Suite("Roster observation", .serialized)
@MainActor
struct RosterObservationTests {
    /// Tripped from inside `onChange`, which runs on the mutating side before the write lands — so
    /// the flag is what is asserted, never the value. Behind a `Mutex` because the callback is
    /// `@Sendable` and the checker will not take our word for where it runs.
    private final class Tripwire: Sendable {
        private let flag = Mutex(false)

        var fired: Bool {
            flag.withLock { $0 }
        }

        func trip() {
            flag.withLock { $0 = true }
        }
    }

    private func watchingSessions(_ hub: Hub) -> Tripwire {
        let tripwire = Tripwire()
        withObservationTracking {
            _ = hub.sessions
        } onChange: {
            tripwire.trip()
        }
        return tripwire
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

        try fixture.hub.driver.setMode(.plan, for: claim.value)

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
