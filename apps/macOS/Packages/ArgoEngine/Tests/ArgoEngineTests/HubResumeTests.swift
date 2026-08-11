@testable import ArgoEngine
import Foundation
import Testing

/// Quitting Argo and coming back (#10): the Session is still there, Argo still knows it started it,
/// and continuing the chain is one call rather than a lost conversation.
@Suite("Hub resume")
@MainActor
struct HubResumeTests {
    private let sessionID = "session-from-cli"

    @Test
    func `a Session the last Argo owned comes back orphaned, not external`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let relaunched = try await quitWithOneOwnedSession(fixture)

        // `external` would be a false claim: Argo started this agent, it just cannot reach it.
        #expect(relaunched.sessions.map(\.provenance) == [.orphaned])
    }

    @Test
    func `resuming continues the chain and takes the Session back`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let relaunched = try await quitWithOneOwnedSession(fixture)

        try await relaunched.resumeSession(sessionID: sessionID)

        #expect(relaunched.sessions.map(\.provenance) == [.managed])
        // One row, not two: the resume continues the Session rather than publishing a fresh one.
        #expect(relaunched.sessions.map(\.id) == [sessionID])
        #expect(Self.resumed(in: fixture) == [sessionID])
    }

    /// The click is the intent, and a click answered while `claude` is still starting is a second
    /// click — not a second agent.
    @Test
    func `resuming the same Session twice yields one agent`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let relaunched = try await quitWithOneOwnedSession(fixture)

        try await relaunched.resumeSession(sessionID: sessionID)
        try await relaunched.resumeSession(sessionID: sessionID)

        #expect(Self.resumed(in: fixture).count == 1)
    }

    @Test
    func `a Session whose PTY is already live resumes nothing`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        _ = try await fixture.hub.spawnSession()
        await hubObserveToEnd(fixture.hub, spawnedSessionObservation(of: fixture))
        #expect(fixture.hub.sessions.map(\.provenance) == [.managed])

        try await fixture.hub.resumeSession(sessionID: sessionID)

        #expect(Self.resumed(in: fixture).isEmpty)
        #expect(fixture.host.started.count == 1)
    }

    /// Out of scope by decision: an `external` Session belongs to whoever started it.
    @Test
    func `a Session Argo never owned is refused`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        await hubObserveToEnd(fixture.hub, spawnedSessionObservation(of: fixture))
        #expect(fixture.hub.sessions.map(\.provenance) == [.external])

        await #expect(throws: SessionResumeError.notArgosToResume) {
            try await fixture.hub.resumeSession(sessionID: sessionID)
        }
    }

    /// #546's rule, unchanged: a Session that could not be resumed must not draw a composer, and
    /// `orphaned` is what keeps it from doing so.
    @Test
    func `a resume whose spawn fails leaves the Session read-only`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let relaunched = try await quitWithOneOwnedSession(fixture)
        fixture.host.refusal = .hostRefused(detail: "no pty")

        await #expect(throws: AgentSpawnError.hostRefused(detail: "no pty")) {
            try await relaunched.resumeSession(sessionID: sessionID)
        }

        #expect(relaunched.sessions.map(\.provenance) == [.orphaned])
    }

    /// Lazy by construction: the roster is rebuilt at launch and nothing on it costs a process
    /// until it is asked for.
    @Test
    func `a relaunch starts no agent of its own`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let relaunched = try await quitWithOneOwnedSession(fixture)

        #expect(relaunched.sessions.count == 1)
        #expect(Self.resumed(in: fixture).isEmpty)
    }

    /// One Argo spawns a Session, sees the record it wrote, and quits. The Hub that comes back
    /// shares the fixture's folders and files and nothing else — which is what a relaunch is.
    private func quitWithOneOwnedSession(_ fixture: SpawnFixture) async throws -> Hub {
        _ = try await fixture.hub.spawnSession()
        await hubObserveToEnd(fixture.hub, spawnedSessionObservation(of: fixture))
        fixture.hub.endOwnedSessions()

        let relaunched = fixture.restarted()
        await hubObserveToEnd(relaunched, spawnedSessionObservation(of: fixture))
        return relaunched
    }

    /// The Sessions `--resume` was given, in the order the launches went out.
    private static func resumed(in fixture: SpawnFixture) -> [String] {
        fixture.host.launches.compactMap { launch in
            guard let flag = launch.arguments.firstIndex(of: "--resume") else { return nil }
            return launch.arguments[safe: flag + 1]
        }
    }
}

private extension [String] {
    subscript(safe index: Int) -> String? {
        indices.contains(index) ? self[index] : nil
    }
}
