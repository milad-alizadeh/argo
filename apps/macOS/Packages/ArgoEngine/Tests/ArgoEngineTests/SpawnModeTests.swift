@testable import ArgoEngine
import Foundation
import Synchronization
import Testing

/// The rung reaching the CLI Argo starts, and reaching the row it publishes for it.
///
/// `--permission-mode` is read at startup and nothing re-reads it, so the spawn is where a stance
/// begins. Verified against `claude` 2.1.227 on 2026-08-11: the flag was accepted, the TUI stood on
/// `accept edits`, and the transcript wrote `acceptEdits` back.
@Suite("Spawn mode")
@MainActor
struct SpawnModeTests {
    @Test
    func `the Code rung is the baseline a spawn stands on`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }

        _ = try await fixture.hub.spawnSession()

        #expect(try Self.rung(of: fixture) == "acceptEdits")
    }

    @Test
    func `a seeded rung is the one the CLI is started on`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }

        _ = try await fixture.hub.spawnSession(seed: SessionSeed(mode: .auto))

        #expect(try Self.rung(of: fixture) == "auto")
    }

    /// The opening prompt is a POSITIONAL, so a flag pair arriving after it would be read as more
    /// prompt — which is why the rung goes on before the handoff's words.
    @Test
    func `a handoff's opening prompt still lands last on argv`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }

        _ = try await fixture.hub.spawnSession(
            seed: SessionSeed(opening: "Continue the review", mode: .readOnly),
        )

        let launch = try #require(fixture.host.launches.first)
        #expect(launch.arguments.last == "Continue the review")
        #expect(try Self.rung(of: fixture) == "plan")
    }

    /// A New Session names no rung, so it takes the one the user last picked — not the baseline it
    /// took before anyone had picked anything (#629).
    @Test
    func `a New Session opens on the rung last picked`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        try await fixture.hub.driver.setMode(.auto, for: claim.value)

        _ = try await fixture.hub.spawnSession()

        #expect(try Self.rung(of: fixture, launch: 1) == "auto")
    }

    /// And it outlives the app: the second Hub over the same file is the next launch, which is the
    /// half of the ticket a value held in memory would pass without doing.
    @Test
    func `the rung last picked outlives a restart`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        try await fixture.hub.driver.setMode(.readOnly, for: claim.value)

        _ = try await fixture.restarted().spawnSession()

        #expect(try Self.rung(of: fixture, launch: 1) == "plan")
    }

    /// A rung the port refused is a rung the Session never stood on, so it is not the one the next
    /// New Session opens on. Refused here by the Turn in flight, which is the ordinary way.
    @Test
    func `a refused rung is not remembered`() async throws {
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
        await #expect(throws: SessionDriveError.modeBusy) {
            try await fixture.hub.driver.setMode(.auto, for: "session-from-cli")
        }

        _ = try await fixture.hub.spawnSession()

        #expect(try Self.rung(of: fixture, launch: 1) == "acceptEdits")
    }

    /// The value the launch stands on, read off argv the way the CLI reads it: the word after the
    /// flag, not merely somewhere on the line.
    private static func rung(of fixture: SpawnFixture, launch index: Int = 0) throws -> String? {
        let launches = fixture.host.launches
        try #require(launches.indices.contains(index))
        let arguments = launches[index].arguments
        guard let flag = arguments.firstIndex(of: "--permission-mode"),
              arguments.indices.contains(flag + 1)
        else { return nil }
        return arguments[flag + 1]
    }

    /// Argo set it, so Argo knows it — the row states the rung before the CLI has written a word.
    @Test
    func `a spawned row reports the rung Argo put it on`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }

        _ = try await fixture.hub.spawnSession(seed: SessionSeed(mode: .code))

        #expect(fixture.hub.sessions.map(\.mode) == [.exactly(.code, cli: "acceptEdits")])
    }

    /// Plan and Read Only set one value, so the intent survives only where Argo is the one holding
    /// it. This is the one rung a reading can never produce.
    @Test
    func `Plan is rendered where Argo set it, and reads as Read Only where it did not`(
    ) async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        _ = try await fixture.hub.spawnSession(seed: SessionSeed(mode: .plan))

        #expect(fixture.hub.sessions.map(\.mode) == [.exactly(.plan, cli: "plan")])

        let observed = hubTestObservation(id: "elsewhere", events: [.mode(cli: "plan")])
        await hubObserveToEnd(fixture.hub, observed)

        let read = try #require(fixture.hub.sessions.first { $0.id == "elsewhere" })
        #expect(read.mode == .exactly(.readOnly, cli: "plan"))
    }

    /// The CLI is the authority the moment it says anything: a stance Argo set and the CLI then
    /// reports differently is the CLI's to state, not Argo's to insist on.
    @Test
    func `an observed value that is not the one Argo set wins`() {
        var session = HubSession(spawn: AgentSpawn(
            claim: .init(value: "claim-1"),
            cli: .claude,
            cwd: "/tmp",
            spawnedAtMs: 0,
            mode: .plan,
        ))

        session.apply(.mode(cli: "auto"))

        #expect(session.mode == .exactly(.auto, cli: "auto"))
    }
}
