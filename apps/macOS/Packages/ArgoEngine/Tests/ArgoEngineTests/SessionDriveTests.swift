@testable import ArgoEngine
import Testing

/// Driving a Session Argo owns — the other direction from everything else in the Hub, which reads
/// the world rather than acting on it.
///
/// The PTY is the only thing standing in for the world here: the claim, the ownership registry and
/// the launch are all real, so what these prove is the whole path from a Session id the roster
/// carries to bytes on a descriptor.
@Suite("Session drive")
@MainActor
struct SessionDriveTests {
    @Test
    func `a Turn typed at the composer reaches the Session's own prompt`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()

        try fixture.hub.driver.send("Fix the caption, not the sort.", to: claim.value)

        let typed = fixture.host.started.last?.written.joined() ?? ""
        #expect(typed.contains("Fix the caption, not the sort."))
        // Submitted, not left sitting in the field: a Turn nobody sent is indistinguishable from
        // one that never arrived.
        #expect(typed.hasSuffix("\r"))
    }

    /// The composer is absent for a Session Argo cannot drive, so reaching this is the race
    /// between drawing it and the PTY going away — and the answer has to be a refusal the surface
    /// can repeat, never a write into nothing.
    @Test
    func `a Session Argo never spawned refuses the Turn`() throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }

        #expect(throws: SessionDriveError.notDrivable) {
            try fixture.hub.driver.send("Are you there", to: "a-session-somebody-else-started")
        }
    }

    @Test
    func `an orphaned Session refuses the Turn its live self would have taken`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        fixture.host.endLastProcess(exitCode: 0)

        #expect(throws: SessionDriveError.notDrivable) {
            try fixture.hub.driver.send("Carry on", to: claim.value)
        }
    }

    /// Return on an empty field would submit an empty Turn to a live agent, which reads as the user
    /// having asked for something and is the one keystroke the composer must not be able to leak.
    @Test
    func `whitespace alone is not a Turn`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()

        #expect(throws: SessionDriveError.nothingToSend) {
            try fixture.hub.driver.send("  \n\t ", to: claim.value)
        }
        #expect(fixture.host.started.last?.written.isEmpty == true)
    }

    /// What a cockpit test drives instead of a CLI. It is here rather than in a test target because
    /// the surfaces that need it are in another module.
    @Test
    func `the in-memory driver answers with what it was asked to send`() throws {
        let driver = InMemorySessionDriver()

        try driver.send("First", to: "session-a")
        try driver.send("Second", to: "session-a")
        try driver.send("Elsewhere", to: "session-b")

        #expect(driver.sent(to: "session-a") == ["First", "Second"])
        #expect(driver.sent(to: "session-b") == ["Elsewhere"])
    }

    @Test
    func `the in-memory driver can refuse, so a failed send has a path to exercise`() {
        let driver = InMemorySessionDriver()
        driver.refusal = .notDrivable

        #expect(throws: SessionDriveError.notDrivable) {
            try driver.send("Anything", to: "session-a")
        }
        #expect(driver.sent(to: "session-a").isEmpty)
    }
}
