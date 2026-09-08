@testable import ArgoEngine
import Testing

/// Ending ONE Session Argo owns (#1290). Until this verb existed the only per-Session exit was the
/// window's, so archiving a running Session left its agent running with no row to say so.
@Suite("Ending one owned Session")
@MainActor
struct HubEndSessionTests {
    /// The PTY closed and the claim given up, which is the whole of what owning a Session is.
    @Test
    func `ending a Session Argo owns closes its PTY and gives up its claim`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()

        _ = await fixture.hub.endSession(id: claim.value)

        #expect(fixture.host.started.last?.isTerminated == true)
        #expect(fixture.hub.ownership.liveClaims.isEmpty)
    }

    /// The one thing window close could never do. A Session ending must leave every other agent
    /// Argo owns exactly where it was.
    @Test
    func `ending one Session leaves the other owned Sessions running`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let ending = try await fixture.hub.spawnSession()
        let staying = try await fixture.hub.spawnSession()

        _ = await fixture.hub.endSession(id: ending.value)

        #expect(fixture.hub.ownership.liveClaims == [staying])
        #expect(fixture.host.started.first?.isTerminated == true)
        #expect(fixture.host.started.last?.isTerminated == false)
    }

    /// A restarted Hub has no PTY, but the Claude argv still carries the exact Session id. That
    /// key reaches the old process without treating another agent in the folder as this one.
    @Test
    func `archiving an orphaned Claude Session ends its identified process`() async throws {
        let signalled = RecordedProcessSignals()
        let state = try await restartedOrphanedHub(
            table: "1201",
            arguments: [1201: ["claude", "--session-id", spawnedChainID]],
            signalled: signalled,
        )
        let fixture = state.fixture
        defer { fixture.remove() }
        let relaunched = state.hub
        #expect(relaunched.sessions.map(\.provenance) == [.orphaned])

        let result = await relaunched.endSession(archiving: true, id: spawnedSessionID)

        #expect(result == .ended)
        #expect(signalled.values == [1201])
    }

    @Test
    func `an ambiguous orphaned Claude match leaves every process alone`() async throws {
        let signalled = RecordedProcessSignals()
        let state = try await restartedOrphanedHub(
            table: "1201\n1202",
            arguments: [
                1201: ["claude", "--session-id", spawnedChainID],
                1202: ["claude", "--resume", spawnedChainID],
            ],
            signalled: signalled,
        )
        let fixture = state.fixture
        defer { fixture.remove() }
        let relaunched = state.hub

        let result = await relaunched.endSession(archiving: true, id: spawnedSessionID)

        #expect(result == .ambiguous)
        #expect(signalled.values.isEmpty)
    }

    private func restartedOrphanedHub(
        table: String,
        arguments: [Int32: [String]],
        signalled: RecordedProcessSignals,
    ) async throws
        -> (fixture: SpawnFixture, hub: Hub) {
        let fixture = try SpawnFixture(orphanedSessionProcess: .init(
            run: { _ in table },
            arguments: { arguments[$0] },
            signal: signalled.record,
        ))
        do {
            _ = try await fixture.hub.spawnSession()
            await hubObserveToEnd(fixture.hub, spawnedSessionObservation(of: fixture))
            let relaunched = fixture.restarted()
            await hubObserveToEnd(relaunched, spawnedSessionObservation(of: fixture))
            return (fixture, relaunched)
        } catch {
            fixture.remove()
            throw error
        }
    }

    /// A Session no claim of this Hub names is external: Argo has no channel to it, whatever its
    /// agent is doing. Ending must touch nothing rather than reach for the nearest process (#1596)
    /// — a folder match is many-to-one, and the wrong agent killed is not a recoverable mistake.
    @Test
    func `ending an external Session touches nothing`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()

        _ = await fixture.hub.endSession(id: "a-session-argo-never-started")

        #expect(fixture.hub.ownership.liveClaims == [claim])
        #expect(fixture.host.started.last?.isTerminated == false)
    }

    /// The PTY reports the exit it was just asked for, so the teardown runs a second time. It must
    /// be harmless: the claim stays given up, and the exit the host reported is the one recorded.
    @Test
    func `a Session ended by hand still records the exit its PTY reports`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()

        _ = await fixture.hub.endSession(id: claim.value)
        // Nothing has reported yet: Argo asked the agent to end, and an exit it has not heard is
        // not a fact it can state.
        #expect(fixture.hub.spawns[claim]?.startup.exit == nil)
        fixture.host.endLastProcess(exitCode: 0)

        #expect(fixture.hub.spawns[claim]?.startup.exit?.code == 0)
        #expect(fixture.hub.ownership.liveClaims.isEmpty)
        #expect(fixture.hub.ownership.provenance(sessionID: claim.value) == .orphaned)
    }

    /// The archive gesture's own rule, which is the seam #1290 exists for: archiving a Session Argo
    /// owns ends it.
    @Test
    func `archiving a Session Argo owns ends it`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()

        _ = await fixture.hub.endSession(archiving: true, id: claim.value)

        #expect(fixture.host.started.last?.isTerminated == true)
        #expect(fixture.hub.ownership.liveClaims.isEmpty)
    }

    /// Putting one back starts nothing and ends nothing. The row comes back read-only, and the
    /// resume gesture is what continues it (#10, ADR-0026).
    @Test
    func `putting a Session back ends nothing`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()

        _ = await fixture.hub.endSession(archiving: false, id: claim.value)

        #expect(fixture.host.started.last?.isTerminated == false)
        #expect(fixture.hub.ownership.liveClaims == [claim])
    }

    /// Window close and app quit still end everything, now as the loop over the same verb.
    @Test
    func `ending the owned Sessions still gives up every live claim`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        _ = try await fixture.hub.spawnSession()
        _ = try await fixture.hub.spawnSession()

        fixture.hub.endOwnedSessions()

        #expect(fixture.hub.ownership.liveClaims.isEmpty)
        #expect(fixture.host.started.first?.isTerminated == true)
        #expect(fixture.host.started.last?.isTerminated == true)
    }
}
