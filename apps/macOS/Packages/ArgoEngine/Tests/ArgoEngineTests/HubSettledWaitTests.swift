@testable import ArgoEngine
import Testing

/// The ending of the wait for a spawned CLI's first byte, as a fact in its own right (#1323).
///
/// The cockpit draws a wait on a plinth while it runs and drops it into the reading as one settled
/// row when it ends, so "not waiting any more" is not enough: something has to say the wait RAN and
/// what it took. These are the two ways it ends, and the assertion that neither is invented for a
/// Session Argo did not start.
@Suite("Hub settled wait")
@MainActor
struct HubSettledWaitTests {
    /// Bytes end the wait, and what it took is recorded with them.
    @Test
    func `the first byte settles the wait`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        _ = try await fixture.hub.spawnSession()
        #expect(fixture.hub.sessions.flatMap(\.settledWaits).isEmpty)

        try #require(fixture.host.started.last).emit("\u{1B}[?1049h")

        let settled = try #require(fixture.hub.sessions.flatMap(\.settledWaits).first)
        #expect(settled.wait == .starting)
        #expect(settled.failure == nil)
        #expect(settled.tookMs >= 0)
    }

    /// A PTY that closed with nothing ever out of it is a start that FAILED, and the reason is the
    /// exit — stated rather than spelled `0`, because absent is not zero.
    @Test
    func `a PTY that closed unheard settles the wait as a failure`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        _ = try await fixture.hub.spawnSession()

        try #require(fixture.host.started.last).end(exitCode: 1)

        let settled = try #require(fixture.hub.sessions.flatMap(\.settledWaits).first)
        #expect(settled.wait == .starting)
        #expect(settled.failure == "the process exited with code 1")
    }

    /// A child that spoke and then died STARTED. The death that follows is news the roster already
    /// carries, and re-telling it here would put a failed row over a Session that came up fine.
    @Test
    func `a CLI that spoke before it died still started`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        _ = try await fixture.hub.spawnSession()
        let child = try #require(fixture.host.started.last)

        child.emit("\u{1B}[?1049h")
        child.end(exitCode: 1)

        let settled = try #require(fixture.hub.sessions.flatMap(\.settledWaits).first)
        #expect(settled.failure == nil)
        #expect(fixture.hub.sessions.flatMap(\.settledWaits).count == 1)
    }

    /// The wait ran once, so it is filed once: a second ending is dropped rather than appended.
    @Test
    func `a wait already settled is not settled twice`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        _ = try await fixture.hub.spawnSession()
        let child = try #require(fixture.host.started.last)

        child.emit("first")
        child.emit("second")

        #expect(fixture.hub.sessions.flatMap(\.settledWaits).count == 1)
    }
}
