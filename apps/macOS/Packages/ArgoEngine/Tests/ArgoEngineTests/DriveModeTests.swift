@testable import ArgoEngine
import Foundation
import Synchronization
import Testing

/// Moving a live Session's rung. `--permission-mode` is read at startup and nothing re-reads it, so
/// the only way in afterwards is the keystroke the TUI binds to `chat:cycleMode`.
///
/// The ring below is not read from a doc: `claude` 2.1.227 was driven in a PTY on 2026-08-11 and
/// its
/// own footer reported `auto → manual → accept edits → plan → auto`. `bypassPermissions` and
/// `dontAsk` are not on it, so cycling can never widen a boundary past `Auto`.
@Suite("Drive mode")
@MainActor
struct DriveModeTests {
    @Test
    func `the ring's distance is counted forward, because shift+tab only goes one way`() {
        #expect(ClaudePermissionMode.cycles(from: "acceptEdits", to: .auto) == 2)
        #expect(ClaudePermissionMode.cycles(from: "auto", to: .code) == 2)
        #expect(ClaudePermissionMode.cycles(from: "plan", to: .auto) == 1)
        // Read Only and Plan are one value, so both are the same distance away.
        #expect(ClaudePermissionMode.cycles(from: "manual", to: .plan) == 2)
        #expect(ClaudePermissionMode.cycles(from: "manual", to: .readOnly) == 2)
    }

    /// Zero is a real answer: re-picking the rung a Session is already on must write nothing.
    @Test
    func `a Session already on the rung is left alone`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession(seed: SessionSeed(mode: .code))

        try await fixture.hub.driver.setMode(.code, for: claim.value)

        #expect(fixture.host.started.last?.written.isEmpty == true)
    }

    /// One keystroke per WRITE, and never two in one (#653): the TUI folds every back-tab that
    /// arrives in a single read into one mode change, so a walk written as one string moves the
    /// Session one rung however many steps it was asked for.
    @Test
    func `a rung two steps round the ring is two separate writes`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession(seed: SessionSeed(mode: .code))

        try await fixture.hub.driver.setMode(.auto, for: claim.value)

        #expect(fixture.host.started.last?.written == ["\u{1B}[Z", "\u{1B}[Z"])
    }

    /// A value with no place on the ring — `dontAsk`, whose boundary Argo cannot see — leaves no
    /// honest count of keystrokes, so nothing is sent. Guessing would walk the ring from a point
    /// Argo does not know it is standing on.
    @Test
    func `a stance Argo cannot establish refuses the change rather than guessing`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        _ = try await fixture.hub.spawnSession()
        await hubObserveToEnd(fixture.hub, hubTestObservation(
            id: "session-from-cli",
            events: [
                .cwd(fixture.projectURL.path),
                .prompt(text: "First prompt", atMs: Date().epochMs),
                .mode(cli: "dontAsk"),
            ],
        ))

        await #expect(throws: SessionDriveError.modeUnreachable) {
            try await fixture.hub.driver.setMode(.readOnly, for: "session-from-cli")
        }
        #expect(fixture.host.started.last?.written.isEmpty == true)
    }

    /// The way round the ring passes through rungs the user did not ask for, `Auto` among them.
    /// That
    /// is nothing while the agent is idle, and a widened boundary while it is mid-Turn — so the
    /// change waits for the Turn rather than racing it.
    @Test
    func `the rung does not move while a Turn is in flight`() async throws {
        // A process in the Session's own folder is the other half of `running`: an open Turn
        // nothing
        // corroborates is quiet, so the fixture has to answer the process table too.
        let live = Mutex<Set<String>>([])
        let fixture = try SpawnFixture(liveness: { live.withLock { $0 } })
        defer { fixture.remove() }
        live.withLock { $0 = [fixture.resolvedProjectPath] }
        _ = try await fixture.hub.spawnSession()
        await fixture.hub.refreshLiveness()
        await hubObserveToEnd(fixture.hub, hubTestObservation(
            id: "session-from-cli",
            events: [
                .cwd(fixture.projectURL.path),
                .mode(cli: "acceptEdits"),
                .prompt(text: "Off you go", atMs: Date().epochMs),
            ],
        ))
        #expect(fixture.hub.sessions.map(\.status) == [.running])

        await #expect(throws: SessionDriveError.modeBusy) {
            try await fixture.hub.driver.setMode(.auto, for: "session-from-cli")
        }
        #expect(fixture.host.started.last?.written.isEmpty == true)
    }

    /// `claude` writes its stance at Turn boundaries, so the record still says what it said before
    /// the first change. Counting the second change from THAT would walk the ring too far — and the
    /// rung it lands on can be wider than the one asked for, which is what `modeBusy` exists to
    /// prevent mid-Turn.
    @Test
    func `a second rung is counted from where the first one landed`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession(seed: SessionSeed(mode: .code))

        try await fixture.hub.driver.setMode(.auto, for: claim.value)
        try await fixture.hub.driver.setMode(.readOnly, for: claim.value)

        // `acceptEdits → auto` is two, and `auto → plan` is three. Counted from the stale record it
        // would have been one, landing the Session on `manual` — a rung nobody asked for.
        #expect(fixture.host.started.last?.written.count == 5)
    }

    /// The one rung the CLI cannot report. It answers `plan` for Read Only and Plan alike, so a
    /// Plan the user picked has to survive the record catching up — or the composer would draw
    /// Read Only the moment it did.
    @Test
    func `Plan survives the record reporting the boundary it shares`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession(seed: SessionSeed(mode: .code))

        try await fixture.hub.driver.setMode(.plan, for: claim.value)
        await hubObserveToEnd(fixture.hub, hubTestObservation(
            id: "session-from-cli",
            events: [.cwd(fixture.projectURL.path), .mode(cli: "plan")],
        ))

        #expect(fixture.hub.sessions.first?.mode == .exactly(.plan, cli: "plan"))
    }

    @Test
    func `a Session Argo does not own refuses the change`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }

        await #expect(throws: SessionDriveError.notDrivable) {
            try await fixture.hub.driver.setMode(.auto, for: "a-session-somebody-else-started")
        }
    }
}
