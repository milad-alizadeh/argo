@testable import ArgoEngine
import Testing

/// The limit on the `starting` wait, and what the row says on each side of it (#1245).
///
/// Before this, two things ended the state: bytes on the PTY, or the process exiting. A child that
/// came up and printed nothing satisfied neither, and the row held `starting` until the window
/// closed. These are the two ways the wait may now end on Argo's own clock, and the assertion that
/// it does not end on that clock while the CLI is merely slow.
@Suite("Hub spawn startup limit")
@MainActor
struct HubSpawnStartupLimitTests {
    @Test
    func `a process still up at the limit stops reading starting`() async throws {
        let fixture = try SpawnFixture(startupPatience: .immediate)
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()

        await fixture.hub.awaitStartupWait(claim)

        // Up and quiet: the process is there, so nothing ended, and the row falls to the DERIVED
        // reading it would have taken had the CLI printed a prompt.
        #expect(fixture.hub.spawns[claim]?.startup.quietAtMs != nil)
        #expect(fixture.hub.spawns[claim]?.startup.exit == nil)
        #expect(fixture.hub.sessions.map(\.status) == [.idle])
        #expect(fixture.hub.sessions.map(\.startedQuietlyAtMs).map { $0 != nil } == [true])
    }

    /// The other half of the ticket's question: a spawn whose `onExit` never fired. Argo asks the
    /// child itself rather than the process table, and writes the exit nobody reported.
    @Test
    func `a process gone at the limit is written as the exit nobody reported`() async throws {
        // Held rather than immediate: the child has to be GONE before the limit fires, and a wait
        // of zero seconds is armed at the spawn and races the line below (`StartupGate`).
        let gate = StartupGate()
        let fixture = try SpawnFixture(startupPatience: .held(by: gate))
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        try #require(fixture.host.started.last).vanish()
        await gate.open()

        await fixture.hub.awaitStartupWait(claim)

        #expect(fixture.hub.spawns[claim]?.startup.quietAtMs == nil)
        // The same row a witnessed exit publishes — no code, because nothing reported one.
        #expect(fixture.hub.sessions.map(\.title) == ["claude exited"])
        #expect(fixture.hub.sessions.map(\.status) == [.ended])
        #expect(fixture.hub.ownership.liveClaims.isEmpty)
    }

    /// The limit may not overrule what Argo actually heard: a CLI that printed inside it is up, and
    /// the clock that fires afterwards has nothing left to say.
    @Test
    func `a CLI that printed inside the limit is never called quiet`() async throws {
        // Held for the same reason, and here it is what makes the test its own name: with a wait
        // of zero seconds the bytes might land after the limit, which is the NEXT test's claim.
        let gate = StartupGate()
        let fixture = try SpawnFixture(startupPatience: .held(by: gate))
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        try #require(fixture.host.started.last).emit("\u{1B}[?1049h")
        await gate.open()

        await fixture.hub.awaitStartupWait(claim)

        #expect(fixture.hub.spawns[claim]?.startup.quietAtMs == nil)
        #expect(fixture.hub.sessions.map(\.startedQuietlyAtMs) == [nil])
    }

    /// A child that speaks LATE is starting late, not quiet: the word the limit wrote is taken back
    /// by the bytes it was waiting for.
    @Test
    func `bytes after the limit take the quiet reading back`() async throws {
        let fixture = try SpawnFixture(startupPatience: .immediate)
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        await fixture.hub.awaitStartupWait(claim)
        #expect(fixture.hub.sessions.map(\.startedQuietlyAtMs).map { $0 != nil } == [true])

        try #require(fixture.host.started.last).emit("ready")

        #expect(fixture.hub.spawns[claim]?.startup.quietAtMs == nil)
        #expect(fixture.hub.sessions.map(\.startedQuietlyAtMs) == [nil])
    }

    /// The limit says how long the silence has run, never that it ended — so #1048's rule survives
    /// it. A Turn typed at a process Argo has still never heard a byte from may not report
    /// `running` at DIRECT: that tier is owed to a PTY that has spoken, and this one has not.
    @Test
    func `a Turn typed after the limit is not reported running`() async throws {
        let fixture = try SpawnFixture(startupPatience: .immediate)
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        await fixture.hub.awaitStartupWait(claim)

        try fixture.hub.driver.send("Fix the caption, not the sort.", to: claim.value)

        #expect(fixture.hub.session(id: claim.value)?.statusReading
            == SessionStatusReading(tier: .derived, status: .idle))
    }

    /// And the rule lifts the moment the CLI does speak, which is what `HubSubmittedTurnTests`
    /// asserts throughout: the bytes are what the DIRECT tier was ever owed to.
    @Test
    func `a Turn typed after the CLI finally speaks reads running again`() async throws {
        let fixture = try SpawnFixture(startupPatience: .immediate)
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        await fixture.hub.awaitStartupWait(claim)
        try #require(fixture.host.started.last).emit("\u{1B}[?1049h")

        try fixture.hub.driver.send("Fix the caption, not the sort.", to: claim.value)

        #expect(fixture.hub.session(id: claim.value)?.statusReading
            == SessionStatusReading(tier: .direct, status: .running))
    }

    /// The default patience is long enough that the clock is never the thing that decides for a CLI
    /// coming up normally — so a spawn under it still reads `starting`.
    @Test
    func `a spawn inside its limit still reads starting`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()

        #expect(fixture.hub.session(id: claim.value)?.statusReading
            == SessionStatusReading(tier: .direct, status: .starting))
    }
}
