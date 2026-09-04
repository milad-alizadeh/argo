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

        fixture.hub.endSession(id: claim.value)

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

        fixture.hub.endSession(id: ending.value)

        #expect(fixture.hub.ownership.liveClaims == [staying])
        #expect(fixture.host.started.first?.isTerminated == true)
        #expect(fixture.host.started.last?.isTerminated == false)
    }

    /// A Session whose PTY has already exited is `orphaned`, and there is nothing left to end. The
    /// verb answers by doing nothing rather than by reaching for a claim that has stood down.
    @Test
    func `ending an orphaned Session touches nothing`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        fixture.host.endLastProcess(exitCode: 0)
        #expect(fixture.hub.ownership.liveClaims.isEmpty)

        fixture.hub.endSession(id: claim.value)

        #expect(fixture.hub.ownership.provenance(sessionID: claim.value) == .orphaned)
    }

    /// A Session no claim of this Hub names is external: Argo has no channel to it, so there is no
    /// process here to end.
    @Test
    func `ending an external Session touches nothing`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()

        fixture.hub.endSession(id: "a-session-argo-never-started")

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

        fixture.hub.endSession(id: claim.value)
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

        fixture.hub.endSession(archiving: true, id: claim.value)

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

        fixture.hub.endSession(archiving: false, id: claim.value)

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
