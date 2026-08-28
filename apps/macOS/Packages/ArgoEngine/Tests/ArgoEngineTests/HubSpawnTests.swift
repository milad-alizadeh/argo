@testable import ArgoEngine
import Foundation
import Testing

/// Argo starting a Session of its own: the row it publishes before any transcript exists, the one
/// row that row becomes when the record turns up, and what happens to it when the PTY dies.
@Suite("Hub spawn")
@MainActor
struct HubSpawnTests {
    @Test
    func `a spawn puts a row in the roster with no transcript on disk`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }

        let claim = try await fixture.hub.spawnSession()

        #expect(fixture.hub.sessions.map(\.id) == [claim.value])
        #expect(fixture.hub.sessions.map(\.title) == ["New session"])
        // Managed and steerable from the moment it exists: Argo holds the claim and the PTY, and
        // both are DIRECT.
        #expect(fixture.hub.sessions.map(\.provenance) == [.managed])
        #expect(fixture.hub.sessions.map(\.status) == [.idle])
        #expect(fixture.hub.sessions.map(\.sourceURL) == [nil])
        // A New Session is started on no ticket, which is absence and not a number (#872).
        #expect(fixture.hub.sessions.map(\.ticket) == [nil])
    }

    @Test
    func `the spawn runs the CLI in the Project folder with Argo holding the PTY`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }

        let claim = try await fixture.hub.spawnSession()
        let launch = try #require(fixture.host.launches.first)

        #expect(launch.cwd == fixture.projectURL.path)
        #expect(launch.executablePath.hasSuffix("/claude"))
        // The PTY is reachable under the claim, which is what "Argo owns it" means in practice.
        let terminal = fixture.hub.terminals.attach(to: claim) { _ in }
        #expect(terminal != nil)
    }

    /// The whole point of the provisional row: one agent is one row, before and after the record.
    @Test
    func `the record the CLI writes replaces the spawn's row rather than adding one`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()

        await hubObserveToEnd(fixture.hub, Self.observedSpawn(of: fixture))

        #expect(fixture.hub.sessions.map(\.id) == ["session-from-cli"])
        #expect(fixture.hub.sessions.map(\.provenance) == [.managed])
        // Retired, not re-keyed: the Session keeps the id the CLI chose, and the claim is gone from
        // the roster rather than sitting beside it.
        #expect(fixture.hub.spawns[claim] == nil)
        #expect(fixture.hub.ownership.ownerOf(sessionID: "session-from-cli") == claim)
    }

    /// The whole of #742: Argo shares its folders with agents nobody here started, and while a
    /// claim is live in one of them a record can appear that is not the transcript Argo named. It
    /// is somebody else's — read-only, and the spawn's own row is still waiting for its file.
    @Test
    func `a record Argo did not name stays external, claim or no claim`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()

        // Same folder, started after the claim opened: everything the old folder-and-window key
        // asked for, and none of what a named transcript asks.
        let stranger = URL(fileURLWithPath: "/tmp/somebody-elses-agent.jsonl")
        await hubObserveToEnd(fixture.hub, hubTestObservation(at: stranger, events: [
            .cwd(fixture.projectURL.path),
            .prompt(text: "Not ours", images: [], atMs: Date().epochMs),
            .turnEnded(.endTurn),
        ]))

        #expect(fixture.hub.session(id: stranger.path)?.provenance == .external)
        #expect(fixture.hub.ownership.ownerOf(sessionID: stranger.path) == nil)
        // And the spawn's own row is untouched: it is still waiting for the file it named.
        #expect(fixture.hub.spawns[claim] != nil)
    }

    /// #363, now moot and kept as a guard: the two sides spell the same folder differently, and the
    /// grade no longer reads the folder at all.
    @Test
    func `a CLI that records a resolved path still reconciles to one Session`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        // What `claude` writes: the same folder reached through `/var` → `/private/var`.
        #expect(fixture.resolvedProjectPath != fixture.projectURL.path)

        await hubObserveToEnd(
            fixture.hub,
            Self.observedSpawn(of: fixture, cwd: fixture.resolvedProjectPath),
        )

        #expect(fixture.hub.sessions.count == 1)
        #expect(fixture.hub.sessions.map(\.provenance) == [.managed])
        #expect(fixture.hub.spawns[claim] == nil)
    }

    @Test
    func `losing the PTY demotes the Session to orphaned`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        _ = try await fixture.hub.spawnSession()
        await hubObserveToEnd(fixture.hub, Self.observedSpawn(of: fixture))
        #expect(fixture.hub.sessions.map(\.provenance) == [.managed])

        fixture.host.endLastProcess(exitCode: 0)

        // Observation survives the PTY; steering does not, and neither does `managed`.
        #expect(fixture.hub.sessions.map(\.provenance) == [.orphaned])
        #expect(fixture.hub.ownership.ownerOf(sessionID: "session-from-cli") == nil)
        #expect(fixture.hub.terminals.attach(to: .init(value: "claim-1")) { _ in } == nil)
    }

    /// The one row no observation can reach: the CLI never wrote a record, so no sweep corrects it.
    @Test
    func `a spawn whose PTY dies before any record says so and ends`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        _ = try await fixture.hub.spawnSession()

        fixture.host.endLastProcess(exitCode: 127)

        #expect(fixture.hub.sessions.map(\.title) == ["claude exited (code 127)"])
        #expect(fixture.hub.sessions.map(\.provenance) == [.orphaned])
        #expect(fixture.hub.sessions.map(\.status) == [.ended])
    }

    @Test
    func `a spawn the host refuses publishes no row and keeps no claim`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        fixture.host.refusal = .hostRefused(detail: "no pty")

        await #expect(throws: AgentSpawnError.hostRefused(detail: "no pty")) {
            try await fixture.hub.spawnSession()
        }

        #expect(fixture.hub.sessions.isEmpty)
        // The claim is released.
        #expect(fixture.hub.ownership.liveClaims.isEmpty)
    }

    /// The spawns outlive a Project switch; what they must not do is follow you into another one.
    @Test
    func `a spawned row does not follow the window into another Project`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        _ = try await fixture.hub.spawnSession()
        let elsewhere = fixture.root.appending(path: "elsewhere", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: elsewhere, withIntermediateDirectories: true)

        await fixture.hub.connect(to: LaunchConfiguration(
            projectURL: elsewhere,
            transcriptURLs: [],
        ))
        let awayRoster = fixture.hub.sessions
        await fixture.hub.connect(to: LaunchConfiguration(
            projectURL: fixture.projectURL,
            transcriptURLs: [],
        ))

        #expect(awayRoster.isEmpty)
        // And it is still there — still owned, still steerable — when you come back.
        #expect(fixture.hub.sessions.map(\.provenance) == [.managed])
        await fixture.hub.disconnect()
    }

    /// #872: the Tickets room starts a Session ON a ticket, and the claim is what reads back.
    @Test
    func `a spawn seeded with a ticket names it from the row's first moment`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }

        _ = try await fixture.hub.spawnSession(seed: SessionSeed(ticket: 872))

        #expect(fixture.hub.sessions.map(\.ticket) == [872])
    }

    /// The whole reason it is filed under the claim: the row is re-keyed to the id the CLI picks,
    /// and a ticket held on the row alone would go with it.
    @Test
    func `the ticket survives the record replacing the spawn's row`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        _ = try await fixture.hub.spawnSession(seed: SessionSeed(ticket: 872))

        await hubObserveToEnd(fixture.hub, Self.observedSpawn(of: fixture))

        #expect(fixture.hub.sessions.map(\.id) == ["session-from-cli"])
        #expect(fixture.hub.sessions.map(\.ticket) == [872])
    }

    @Test
    func `a Hub with no process host cannot spawn`() async {
        let hub = testHub(projectURL: URL(fileURLWithPath: "/tmp"))

        await #expect(throws: AgentSpawnError.self) {
            try await hub.spawnSession()
        }
    }

    @Test
    func `ending owned Sessions kills every PTY and closes every claim`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        _ = try await fixture.hub.spawnSession()
        _ = try await fixture.hub.spawnSession()

        fixture.hub.endOwnedSessions()

        #expect(fixture.host.started.filter(\.isTerminated).count == 2)
        #expect(fixture.hub.ownership.liveClaims.isEmpty)
    }

    /// The record a spawned CLI writes: its own id, the folder it ran in, and a moment inside the
    /// claim's window.
    private static func observedSpawn(
        of fixture: SpawnFixture,
        cwd: String? = nil,
    )
        -> TranscriptObservation {
        hubTestObservation(
            id: "session-from-cli",
            events: [
                .cwd(cwd ?? fixture.projectURL.path),
                .prompt(text: "First prompt", images: [], atMs: Date().epochMs),
                .turnEnded(.endTurn),
            ],
        )
    }
}
