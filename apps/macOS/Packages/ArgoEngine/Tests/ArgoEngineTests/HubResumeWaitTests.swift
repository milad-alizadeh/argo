@testable import ArgoEngine
import Testing

/// The wait a resume opens, in the feed (#1328). It is `starting`'s twin — same clock, same row,
/// told apart only by which one Argo was doing — and `resuming` is what the plinth reads that off.
///
/// Its own suite for the reason `HubSpawnStartingTests` is beside `HubResumeTests`: what it draws
/// is a case of the wait `HubSpawnStartupLimitTests` already covers for a fresh spawn.
@Suite("Hub resume wait")
@MainActor
struct HubResumeWaitTests {
    private let sessionID = spawnedSessionID

    @Test
    func `resuming reads starting with resuming true before the CLI speaks`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let relaunched = try await HubResumeTests.quitWithOneOwnedSession(fixture)

        try await relaunched.resumeSession(sessionID: sessionID)

        #expect(relaunched.session(id: sessionID)?.statusReading
            == SessionStatusReading(tier: .direct, status: .starting))
        #expect(relaunched.session(id: sessionID)?.resuming == true)
    }

    /// A fresh spawn is unaffected by any of this: `resuming` stays false, which is what keeps the
    /// plinth reading `starting` for the case it always has.
    @Test
    func `a fresh spawn is not read as a resume`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()

        #expect(fixture.hub.session(id: claim.value)?.resuming == false)
    }

    /// A resume whose PTY goes without a byte is a start that FAILED, exactly as a fresh spawn's
    /// is — filed as `.resuming` rather than `.starting`, which is the one thing that has to differ
    /// for the settled row to say the right sentence.
    @Test
    func `a resume whose PTY exits with nothing settles as a failed resuming wait`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let relaunched = try await HubResumeTests.quitWithOneOwnedSession(fixture)
        try await relaunched.resumeSession(sessionID: sessionID)
        let claim = try #require(relaunched.ownership.ownerOf(sessionID: sessionID))

        fixture.host.endLastProcess(exitCode: 1)

        let settled = relaunched.facts(forClaim: claim).settledWaits
        #expect(settled.map(\.wait) == [.resuming])
        #expect(settled.first?.failure == "the process exited with code 1")
    }
}
