@testable import ArgoEngine
import Testing

/// Driving a Session Argo owns. The PTY is the only stand-in here — the claim, the ownership
/// registry and the launch are real, so the whole path from Session id to bytes is covered.
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

    /// Reachable only by the race between drawing the composer and the PTY going away: the answer
    /// is a refusal, never a write into nothing.
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

    /// Return on an empty field would submit an empty Turn to a live agent.
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

    /// A bare `ESC` and nothing else (#541) — a Return after it would submit a Turn.
    @Test
    func `an interrupt reaches the Session's prompt as a bare escape`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()

        try fixture.hub.driver.interrupt(claim.value)

        #expect(fixture.host.started.last?.written == ["\u{1B}"])
    }

    /// The interrupt does not ask whether a Turn is running: that reading is DERIVED, so refusing
    /// on it would report Argo's own lag as user error.
    @Test
    func `stopping a Session that is running nothing is harmless`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()

        try fixture.hub.driver.interrupt(claim.value)
        try fixture.hub.driver.interrupt(claim.value)

        #expect(fixture.host.started.last?.written == ["\u{1B}", "\u{1B}"])
    }

    /// The point of `ESC` over anything that ends a process: the Session is still there afterwards.
    @Test
    func `a Session takes the next Turn after being stopped`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()

        try fixture.hub.driver.interrupt(claim.value)
        try fixture.hub.driver.send("Do the other thing instead.", to: claim.value)

        let typed = fixture.host.started.last?.written ?? []
        #expect(typed.first == "\u{1B}")
        #expect(typed.last?.contains("Do the other thing instead.") == true)
        #expect(typed.last?.hasSuffix("\r") == true)
    }

    @Test
    func `an orphaned Session refuses the interrupt its live self would have taken`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        fixture.host.endLastProcess(exitCode: 0)

        #expect(throws: SessionDriveError.notDrivable) {
            try fixture.hub.driver.interrupt(claim.value)
        }
    }

    /// The sentence the CLI writes for it, matched whole: a message that merely quotes the marker
    /// would otherwise put a Turn boundary through what somebody said.
    @Test
    func `the interrupt marker is recognised only when it is the whole entry`() {
        #expect(ClaudeInterrupt.isMark(ClaudeInterrupt.mark))
        #expect(ClaudeInterrupt.isMark("  \(ClaudeInterrupt.mark)\n"))
        #expect(!ClaudeInterrupt.isMark("Why did \(ClaudeInterrupt.mark) show up twice?"))
        #expect(!ClaudeInterrupt.isMark("Carry on."))
    }

    /// What a cockpit test drives instead of a CLI. Not in a test target: the surfaces that need it
    /// are in another module.
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
