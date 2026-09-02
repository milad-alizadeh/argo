@testable import ArgoEngine
import Foundation
import Testing

/// The Hub answering the three acts a handoff is made of — the wiring under `SessionHandoff`, which
/// asserts the order they go in.
@Suite("Hub handoff")
@MainActor
struct HubHandoffTests {
    /// What typing `/handoff` actually is: the keystrokes of a submitted Turn, down the PTY of the
    /// claim that owns this Session. The header's button is not a terminal pane.
    ///
    /// The Return is asserted as the literal CR rather than against `ClaudeTurn`'s own spelling,
    /// which would be the code under test computing its own expectation — green whatever byte it
    /// chose, including the line feed of #628 that left the command sitting in the composer.
    @Test
    func `steering a managed Session types a submitted Turn at its own PTY`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        _ = try await fixture.hub.spawnSession()
        await hubObserveToEnd(fixture.hub, spawnedSessionObservation(of: fixture))

        #expect(fixture.hub.steer(sessionID: spawnedSessionID, typing: "/handoff /tmp/b.md"))
        fixture.dropTurnWatch(on: spawnedSessionID)

        // The Turn is two writes with a pause between them (#682), so the Return is waited for.
        let written = await fixture.keystrokes(exactly: 2)
        #expect(written.first?.contains("/handoff /tmp/b.md") == true)
        #expect(written.last == "\r")
    }

    /// Story 49 in the engine's own terms. An orphaned Session's claim outlived its PTY, so there
    /// is no prompt to type at — and Argo says so rather than dropping the keystrokes.
    @Test
    func `an orphaned Session cannot be steered`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        _ = try await fixture.hub.spawnSession()
        await hubObserveToEnd(fixture.hub, spawnedSessionObservation(of: fixture))
        fixture.host.endLastProcess(exitCode: 0)

        #expect(!fixture.hub.steer(sessionID: spawnedSessionID, typing: "/handoff"))
    }

    @Test
    func `a Session Argo never owned cannot be steered`() throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }

        #expect(!fixture.hub.steer(sessionID: "somebody-elses-session", typing: "/handoff"))
    }

    /// The brief comes back verbatim, and a path with nothing at it comes back absent. What counts
    /// AS a brief is `SessionHandoff`'s rule and is asserted there; this reads a file.
    @Test
    func `a brief is read whole, and an unwritten one is absent`() throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let path = fixture.root.appending(path: "brief.md").path

        #expect(fixture.hub.brief(at: path) == nil)
        try "# Where this got to".write(toFile: path, atomically: true, encoding: .utf8)
        #expect(fixture.hub.brief(at: path) == "# Where this got to")
    }

    /// Story 48, at the seam that carries it: the fresh Session runs in the folder it was given
    /// rather than the Project's, and opens on the prompt it was seeded with.
    @Test
    func `a seeded spawn runs where it is told and opens on what it is given`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        // Inside the Project, because a handoff spawns into the FULL Session's own folder.
        let elsewhere = fixture.projectURL.appending(path: "sub", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: elsewhere, withIntermediateDirectories: true)

        let id = try await fixture.hub.spawn(SessionSeed(
            cwd: elsewhere.path,
            opening: "Read the handoff brief at /tmp/b.md.",
        ))

        let launch = try #require(fixture.host.launches.first)
        #expect(launch.cwd == elsewhere.path)
        #expect(launch.arguments.last == "Read the handoff brief at /tmp/b.md.")
        #expect(launch.arguments.dropLast().contains("--mcp-config"))
        // And it is a managed row in the roster like any other spawn.
        #expect(fixture.hub.sessions.map(\.id) == [id])
        #expect(fixture.hub.sessions.map(\.provenance) == [.managed])
    }

    /// The unseeded spawn is untouched: a New Session still runs in the Project's folder and opens
    /// on nothing typed.
    @Test
    func `an unseeded spawn is the New Session it always was`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }

        _ = try await fixture.hub.spawnSession()

        let launch = try #require(fixture.host.launches.first)
        #expect(launch.cwd == fixture.projectURL.path)
        // The companion's flags, the baseline rung (#545), the transcript this spawn is told to
        // write (#742), and no prompt behind them.
        #expect(launch.arguments == [
            "--mcp-config", launch.arguments[1],
            "--plugin-dir", launch.arguments[3],
            "--permission-mode", "acceptEdits",
            "--session-id", spawnedChainID,
        ])
    }

    /// The fresh row is published under a claim id and re-keyed to the id its CLI picks, so a link
    /// holding the id it was handed goes nowhere once the fresh agent writes its first record.
    @Test
    func `the handed-off Session names the fresh row, through the rebind`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        // The full Session first, so no claim covers it: it is somebody else's agent, observed.
        await hubObserveToEnd(fixture.hub, handedOffSessionObservation(of: fixture))
        let fresh = try await fixture.hub.spawn(SessionSeed(cwd: fixture.projectURL.path))
        fixture.hub.handedOff(sessionID: "full-session", to: fresh)

        #expect(Self.handedOffTo(in: fixture.hub, from: "full-session") == fresh)

        // The fresh agent writes its first record, and its row stands down in favour of the one the
        // CLI named. The link has to arrive at the same place.
        await hubObserveToEnd(fixture.hub, spawnedSessionObservation(of: fixture))

        #expect(Self.handedOffTo(in: fixture.hub, from: "full-session") == spawnedSessionID)
        #expect(fixture.hub.sessions.count == 2)
    }

    /// Every other Session says nothing, rather than an absent link reading as one to nowhere.
    @Test
    func `a Session that handed nothing over carries no chain`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        await hubObserveToEnd(fixture.hub, handedOffSessionObservation(of: fixture))

        #expect(Self.handedOffTo(in: fixture.hub, from: "full-session") == nil)
    }

    /// Briefs are owned state in application support, beside the Project registry — never in the
    /// Project.
    @Test
    func `briefs land in Argo's own per-machine data`() {
        #expect(Hub.handoffRoot.lastPathComponent == "handoffs")
        #expect(Hub.handoffRoot.deletingLastPathComponent()
            == ProjectRegistryStore.defaultFileURL.deletingLastPathComponent())
    }

    private static func handedOffTo(in hub: Hub, from sessionID: String) -> String? {
        hub.sessions.first { $0.id == sessionID }?.handedOffTo
    }
}
