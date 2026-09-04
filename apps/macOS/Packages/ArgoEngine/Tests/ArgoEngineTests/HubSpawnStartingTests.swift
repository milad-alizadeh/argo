@testable import ArgoEngine
import Testing

/// The `starting` a spawn is published in, and what ends it. A spawned CLI writes no record until
/// its first prompt, so the wait before that is one no record covers — and the only honest end to
/// it is the child's own first bytes, on a descriptor Argo owns (#587).
@Suite("Hub spawn starting")
@MainActor
struct HubSpawnStartingTests {
    /// The end of the claim, which is what makes it allowed at all: the row stops saying
    /// `starting` on something Argo observed rather than on a clock.
    @Test
    func `the CLI's first bytes off the PTY end the starting claim`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        #expect(fixture.hub.session(id: claim.value)?.statusReading
            == SessionStatusReading(tier: .direct, status: .starting))

        try #require(fixture.host.started.last).emit("\u{1B}[?1049h")

        // Idle, exactly as the row read before this state existed: the CLI is up and has been
        // asked nothing.
        #expect(fixture.hub.sessions.map(\.status) == [.idle])
    }

    /// The moment is witnessed once, and it has to be: `Hub.rosterStamp` reads the spawns, so a
    /// moment restamped per chunk would rebuild the whole roster for every byte the agent prints.
    @Test
    func `the first bytes are witnessed once, however many follow them`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        let process = try #require(fixture.host.started.last)

        process.emit("first")
        let witnessed = fixture.hub.spawns[claim]?.startup.firstOutputAtMs
        process.emit("second")

        #expect(witnessed != nil)
        #expect(fixture.hub.spawns[claim]?.startup.firstOutputAtMs == witnessed)
    }
}
