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

    /// A bare `ESC` and nothing else (#541). No Return after it: a submit would be a Turn, and what
    /// this sends is the key that ends one.
    @Test
    func `an interrupt reaches the Session's prompt as a bare escape`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()

        try fixture.hub.driver.interrupt(claim.value)

        #expect(fixture.host.started.last?.written == ["\u{1B}"])
    }

    /// The interrupt does NOT ask whether a Turn is running, and this is where that shows: two
    /// stops in a row are two keystrokes rather than a refusal on the second. Whether something was
    /// running is a DERIVED reading, and refusing on it would report Argo's own lag as user error.
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
    /// A stop that took the agent down with the Turn would be a close with extra steps.
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

    /// The sentence the CLI writes for it, matched whole. A message that merely QUOTES the marker
    /// is a message: read as the marker it would put a Turn boundary through the middle of what
    /// somebody said.
    @Test
    func `the interrupt marker is recognised only when it is the whole entry`() {
        #expect(ClaudeInterrupt.isMark(ClaudeInterrupt.mark))
        #expect(ClaudeInterrupt.isMark("  \(ClaudeInterrupt.mark)\n"))
        #expect(!ClaudeInterrupt.isMark("Why did \(ClaudeInterrupt.mark) show up twice?"))
        #expect(!ClaudeInterrupt.isMark("Carry on."))
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
