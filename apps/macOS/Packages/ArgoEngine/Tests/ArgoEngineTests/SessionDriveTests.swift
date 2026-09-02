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

        try fixture.typeTurn("Fix the caption, not the sort.", to: claim.value)

        let typed = await fixture.keystrokes(exactly: 2)
        #expect(typed.first?.contains("Fix the caption, not the sort.") == true)
        // Submitted, not left sitting in the field: a Turn nobody sent is indistinguishable from
        // one that never arrived.
        #expect(typed.last == "\r")
    }

    /// The Return arrives as its OWN write (#682). Written with the paste, it is read in the same
    /// batch as the file-mention popup an `@` token opens — which takes it as its accept key and
    /// leaves the Turn in the composer, sent-looking and unsent.
    @Test
    func `a Turn's Return reaches the PTY as a write of its own`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()

        try fixture.typeTurn("what is @README.md about?", to: claim.value)

        let typed = await fixture.keystrokes(exactly: 2)
        #expect(typed.first?.hasSuffix("\r") == false)
        #expect(typed.last == "\r")
    }

    /// The pause the split opens is a window a second Turn could land in, and a paste that landed
    /// there would be submitted by the FIRST Turn's Return — the two messages arriving as one Turn.
    /// Reachable from the composer alone: a queue released when a Turn ends sends its follow-ups
    /// one after another.
    ///
    /// Asserted slot by slot and not by count alone, because the two catch different things. A
    /// keystroke of Argo's own can land in the pause without changing the total: the delivery
    /// watch's bare Return once did, leaving `[paste, CR, CR, paste]` — four writes, wrong order,
    /// and the second Turn still unsent when the count said it had gone (#1040).
    @Test
    func `a second Turn cannot land between the first Turn's paste and its Return`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()

        try fixture.typeTurn("First", to: claim.value)
        try fixture.typeTurn("Second", to: claim.value)

        let typed = await fixture.keystrokes(exactly: 4)
        #expect(typed.first?.contains("First") == true)
        #expect(typed[1] == "\r")
        #expect(typed[2].contains("Second"))
        #expect(typed.last == "\r")
    }

    /// What the delivery watch spends its silence on (#682), at the PTY rather than at the port
    /// that counts them: ONE bare Return, so a Turn the file-mention popup swallowed is submitted
    /// where it sits. A paste here would retype the whole message into a composer that may still
    /// be holding it.
    @Test
    func `the watch answers silence with a bare Return at the prompt`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()

        #expect(fixture.hub.adapters.resubmit(claim.value))

        #expect(fixture.host.started.last?.written == ["\r"])
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
        try fixture.typeTurn("Do the other thing instead.", to: claim.value)

        let typed = await fixture.keystrokes(exactly: 3)
        #expect(typed.first == "\u{1B}")
        #expect(typed.dropFirst().first?.contains("Do the other thing instead.") == true)
        #expect(typed.last == "\r")
    }

    /// Only the Return waits (#682). The paste goes when it is asked for, so a keystroke asked for
    /// AFTERWARDS cannot overtake it — a Stop pressed on a Turn reaching the agent before the Turn
    /// it was pressed on would be Argo inventing an order the user never typed.
    @Test
    func `a keystroke asked for after a Turn cannot overtake its paste`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()

        try fixture.typeTurn("Off you go.", to: claim.value)
        try fixture.hub.driver.interrupt(claim.value)

        // Asserted BEFORE the Return has had its pause: the paste is already out, and the `ESC`
        // behind it. Holding the `ESC` back instead is what would pace a mode walk into one read.
        let atOnce = fixture.host.started.last?.written ?? []
        #expect(atOnce.count == 2)
        #expect(atOnce.first?.contains("Off you go.") == true)
        #expect(atOnce.last == "\u{1B}")

        let typed = await fixture.keystrokes(exactly: 3)
        #expect(typed.last == "\r")
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
