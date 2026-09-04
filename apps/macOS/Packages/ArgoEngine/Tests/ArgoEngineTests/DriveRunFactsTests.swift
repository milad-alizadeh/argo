@testable import ArgoEngine
import Foundation
import Synchronization
import Testing

/// Setting the Session's Model and Effort — the CLI's own two knobs (#558).
///
/// Neither is walked to. `/model <id>` and `/effort <level>` NAME a value at the prompt, so what
/// this suite pins is the line that goes, the fact that it goes as a paced paste rather than one
/// write, and the two moments where nothing may go at all.
///
/// The vocabulary is not read off a doc: `claude --help` was read on 2026-09-03 at 2.1.257, where
/// `--effort <level>` documents five levels — `low, medium, high, xhigh, max` — and `--model`
/// documents an alias or a full name.
@Suite("Drive run facts")
@MainActor
struct DriveRunFactsTests {
    @Test
    func `the effort scale is the CLI's own five words, in the CLI's own order`() {
        #expect(SessionEffort.allCases.map(\.rawValue)
            == ["low", "medium", "high", "xhigh", "max"])
    }

    /// The read-back that the whole popover hangs off: a word on the ladder ticks its rung, and a
    /// word off it ticks nothing while still stating itself.
    @Test
    func `an effort the ladder has no rung for reads back verbatim and ticks nothing`() {
        #expect(ClaudeEffort.reading(of: "xhigh") == .exactly(.xhigh, cli: "xhigh"))
        #expect(ClaudeEffort.reading(of: "ludicrous") == .unknown(cli: "ludicrous"))
        #expect(ClaudeEffort.reading(of: "ludicrous").rung == nil)
        #expect(ClaudeEffort.reading(of: "ludicrous").cliValue == "ludicrous")
    }

    /// Verbatim, and pointedly for a model Argo's readable table has never heard of: normalising
    /// here would be Argo deciding which models exist.
    @Test
    func `the model id is typed exactly as it was asked for`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession(seed: SessionSeed(mode: .code))

        try await fixture.hub.driver.setModel("claude-mythos-7-20270101", for: claim.value)

        #expect(fixture.host.started.last?.written.first?
            .contains("/model claude-mythos-7-20270101") == true)
    }

    /// Two writes, never one: `/` opens the command picker inside the input batch, and a Return in
    /// that same batch is taken by the picker rather than submitting the line (#682).
    ///
    /// The Return is waited FOR rather than waited on — the call returns once the paste has gone,
    /// exactly as `send` does, so the second write lands after it. Polling for the count rather
    /// than sleeping the gap, so the claim holds on a slow machine.
    @Test
    func `a run-facts line arrives as a paced paste and a separate Return`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession(seed: SessionSeed(mode: .code))

        try await fixture.hub.driver.setEffort(.xhigh, for: claim.value)
        #expect(fixture.host.started.last?.written.count == 1)
        while (fixture.host.started.last?.written.count ?? 0) < 2 {
            await Task.yield()
        }

        let written = try #require(fixture.host.started.last?.written)
        #expect(written == ["\u{1B}[200~/effort xhigh\u{1B}[201~", ClaudeTurn.submit])
    }

    /// Mid-Turn the CLI QUEUES a typed line as the next prompt instead of running it, so a `/model`
    /// sent here would surface in the feed as something the user said — long after the popover
    /// claimed the model had moved.
    @Test
    func `neither knob moves while a Turn is in flight`() async throws {
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
                .prompt(text: "Off you go", images: [], atMs: Date().epochMs),
            ],
        ))
        #expect(fixture.hub.sessions.map(\.status) == [.running])

        await #expect(throws: SessionDriveError.runFactsBusy) {
            try await fixture.hub.driver.setModel("opus", for: "session-from-cli")
        }
        await #expect(throws: SessionDriveError.runFactsBusy) {
            try await fixture.hub.driver.setEffort(.max, for: "session-from-cli")
        }
        #expect(fixture.host.started.last?.written.isEmpty == true)
    }

    /// The other prompt nothing may be typed at (#1217). A Session blocked on a Permission or a
    /// question has no Turn in flight, so the mid-Turn guard above never saw it — and its keyboard
    /// belongs to a DIALOG, which takes the line and the Return behind it. `starting` is not among
    /// them: the prompt is on its way rather than held, and a Session is set up in that moment.
    @Test
    func `a typed line is refused wherever the prompt is not the CLI's own`() {
        #expect(!SessionStatus.running.takesTypedLine)
        #expect(!SessionStatus.permission.takesTypedLine)
        #expect(!SessionStatus.asking.takesTypedLine)
        #expect(SessionStatus.starting.takesTypedLine)
        #expect(SessionStatus.idle.takesTypedLine)
        #expect(SessionStatus.stopped.takesTypedLine)
        #expect(SessionStatus.unknown.takesTypedLine)
    }

    /// Unlike a rung, neither is remembered. A rung is filed because the ring is walked from a
    /// reading a set invalidates; these are named, and the CLI's own next record states where they
    /// landed — so a copy here would be a second answer to the transcript's question.
    @Test
    func `setting a model files no rung of its own`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession(seed: SessionSeed(mode: .code))

        try await fixture.hub.driver.setModel("sonnet", for: claim.value)

        #expect(fixture.hub.sessions.first?.modeSet?.mode == .code)
    }
}

/// What the two knobs mean for an adapter that has neither (#558).
@Suite("Run facts capability")
@MainActor
struct RunFactsCapabilityTests {
    /// Declared, not discovered: the composer omits the section rather than drawing a control that
    /// cannot work, and the port refuses the race where a popover outlived the declaration.
    @Test
    func `an adapter declaring neither knob refuses both rather than accepting quietly`(
    ) async throws {
        let driver = InMemorySessionDriver()
        driver.declaredSurface = DriveSurface(
            takesAttachments: true,
            runsCommands: false,
            resolvesMentions: false,
        )

        await #expect(throws: SessionDriveError.runFactsUnsupported) {
            try await driver.setModel("opus", for: "s1")
        }
        await #expect(throws: SessionDriveError.runFactsUnsupported) {
            try await driver.setEffort(.high, for: "s1")
        }
        #expect(driver.modelsAsked(for: "s1").isEmpty)
        #expect(driver.effortsAsked(for: "s1").isEmpty)
    }

    @Test
    func `an adapter declaring both records what it was asked for`() async throws {
        let driver = InMemorySessionDriver()
        driver.declaredSurface = DriveSurface(
            takesAttachments: true,
            runsCommands: true,
            resolvesMentions: true,
            chooses: .both,
        )

        try await driver.setModel("claude-opus-5", for: "s1")
        try await driver.setEffort(.xhigh, for: "s1")

        #expect(driver.modelsAsked(for: "s1") == ["claude-opus-5"])
        #expect(driver.effortsAsked(for: "s1") == [.xhigh])
    }
}
