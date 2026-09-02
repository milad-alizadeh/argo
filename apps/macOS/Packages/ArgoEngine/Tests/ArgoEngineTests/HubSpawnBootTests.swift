@testable import ArgoEngine
import Foundation
import Testing

/// The boot Argo can SEE. A spawned CLI writes no record until its first prompt, so between the
/// PTY starting and the agent being ready at it there is a wait nothing in the record covers — and
/// the only honest end to it is the child's own first bytes, on a descriptor Argo owns (#587).
@Suite("Hub spawn boot")
@MainActor
struct HubSpawnBootTests {
    /// The end of the `starting` claim, and the whole reason it is allowed to be made: the first
    /// bytes off the PTY are a DIRECT fact about a process Argo started, so the row stops saying
    /// "starting" on an observation rather than on a clock (#587).
    @Test
    func `the CLI's first bytes off the PTY end the starting claim`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        #expect(fixture.hub.session(id: claim.value)?.statusReading
            == SessionStatusReading(tier: .direct, status: .starting))

        try #require(fixture.host.started.last).emit("\u{1B}[?1049h")

        // Idle and DERIVED, exactly as the row read before this state existed: the boot is over
        // and nothing has been asked of the agent.
        #expect(fixture.hub.sessions.map(\.status) == [.idle])
    }

    /// The write is once, and it has to be: `Hub.rosterStamp` reads the spawns, so a moment
    /// restamped per chunk would rebuild the whole roster for every byte the agent prints.
    @Test
    func `only the FIRST chunk is recorded, however many follow it`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        let process = try #require(fixture.host.started.last)

        process.emit("first")
        let witnessed = fixture.hub.spawns[claim]?.firstOutputAtMs
        process.emit("second")

        #expect(witnessed != nil)
        #expect(fixture.hub.spawns[claim]?.firstOutputAtMs == witnessed)
    }
}
