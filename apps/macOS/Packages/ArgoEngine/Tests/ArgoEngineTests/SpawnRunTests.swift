@testable import ArgoEngine
import Foundation
import Testing

/// The Model and Effort reaching the CLI Argo starts, and reaching the row it publishes for it
/// (#1175).
///
/// `--model` and `--effort` are read at startup and nothing re-reads them, so the spawn is where a
/// run begins. Verified against `claude` 2.1.257 on 2026-09-03: `--model <alias>` and
/// `--effort <level>` are both documented flags.
@Suite("Spawn run")
@MainActor
struct SpawnRunTests {
    @Test
    func `a spawn with nothing ever picked opens on Opus and Medium`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }

        _ = try await fixture.hub.spawnSession()

        #expect(fixture.launchedModel() == "opus")
        #expect(fixture.launchedEffort() == "medium")
    }

    /// The pair the user picked on a live Session is the one the NEXT New Session opens on — the
    /// half of the ticket the store exists for.
    @Test
    func `a New Session opens on the Model and Effort last picked`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        try await fixture.hub.driver.setModel("sonnet", for: claim.value)
        try await fixture.hub.driver.setEffort(.high, for: claim.value)

        _ = try await fixture.hub.spawnSession()

        #expect(fixture.launchedModel(1) == "sonnet")
        #expect(fixture.launchedEffort(1) == "high")
    }

    /// And it outlives the app: the second Hub over the same file is the next launch, which is the
    /// half of the ticket a value held in memory would pass without doing.
    @Test
    func `the pair last picked outlives a restart`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        try await fixture.hub.driver.setModel("haiku", for: claim.value)

        _ = try await fixture.restarted().spawnSession()

        #expect(fixture.launchedModel(1) == "haiku")
    }

    /// The opening prompt is a POSITIONAL, so a flag pair arriving after it would be read as more
    /// prompt — which is why the run goes on before the handoff's words.
    @Test
    func `a handoff's opening prompt still lands last on argv`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }

        _ = try await fixture.hub.spawnSession(seed: SessionSeed(opening: "Continue the review"))

        let launch = try #require(fixture.host.launches.first)
        #expect(launch.arguments.last == "Continue the review")
        #expect(fixture.launchedModel() == "opus")
    }

    /// Codex declares neither knob and takes neither flag, so it is started on nothing — a default
    /// it would ignore is a value the composer would then state about a Session nothing put it on.
    @Test
    func `a codex spawn carries neither flag`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }

        _ = try await fixture.hub.spawnSession(cli: .codex)

        #expect(fixture.launchedModel() == nil)
        #expect(fixture.launchedEffort() == nil)
        #expect(fixture.hub.sessions.map(\.model) == [nil])
        #expect(fixture.hub.sessions.map(\.effort) == [nil])
    }

    /// Argo put the words on argv, so Argo knows them — the row states the pair before the CLI has
    /// written a word, rather than `unknown`.
    @Test
    func `a spawned row reports the run Argo started it at`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }

        _ = try await fixture.hub.spawnSession()

        let session = try #require(fixture.hub.sessions.first)
        #expect(session.status == .starting)
        #expect(session.model == "opus")
        #expect(session.effort == "medium")
    }

    /// And the first record's reading supersedes it, verbatim — including a model Argo did not ask
    /// for, which is what a `/model` typed at the prompt looks like from outside.
    @Test
    func `the record's own reading supersedes the launch value`() {
        var session = HubSession(spawn: AgentSpawn(
            claim: .init(value: "claim-1"),
            cli: .claude,
            cwd: "/tmp",
            spawnedAtMs: 0,
        ))
        session.launchedRun = SessionRun(model: "opus", effort: .medium)

        session.apply(.model("claude-sonnet-5"))
        session.apply(.effort(cli: "xhigh"))

        #expect(session.model == "claude-sonnet-5")
        #expect(session.effort == "xhigh")
    }

    /// A resume continues one Session's work, so it comes back on what THAT Session was running
    /// at — never on whatever was last picked app-wide, which would move it off its own model
    /// without anyone asking (the rule `rung(resuming:)` already holds for the ladder).
    @Test
    func `a resumed Session comes back on its own Model and Effort`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        try await fixture.hub.driver.setModel("haiku", for: claim.value)
        await hubObserveToEnd(fixture.hub, hubTestObservation(
            at: spawnedTranscriptURL,
            events: [
                .cwd(fixture.projectURL.path),
                .model("claude-sonnet-5"),
                .effort(cli: "xhigh"),
            ],
        ))

        _ = try await fixture.hub.spawnSession(
            seed: SessionSeed(resuming: SessionResumeTarget(
                chainID: spawnedChainID,
                sessionID: spawnedSessionID,
            )),
        )

        #expect(fixture.launchedModel(1) == "claude-sonnet-5")
        #expect(fixture.launchedEffort(1) == "xhigh")
    }

    /// And where nothing can say what that Session ran at — its records name neither, and the
    /// launch value died with the process that carried it — the pair last picked is the only
    /// defensible answer, which is the fall-through the rung takes for the same reason.
    @Test
    func `a resumed Session with no reading of its own takes the pair last picked`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        try await fixture.hub.driver.setEffort(.low, for: claim.value)

        // The next launch: its roster has the record but none of the first Hub's claims.
        let restarted = fixture.restarted()
        await hubObserveToEnd(restarted, hubTestObservation(
            at: spawnedTranscriptURL,
            events: [.cwd(fixture.projectURL.path)],
        ))
        _ = try await restarted.spawnSession(
            seed: SessionSeed(resuming: SessionResumeTarget(
                chainID: spawnedChainID,
                sessionID: spawnedSessionID,
            )),
        )

        #expect(fixture.launchedModel(1) == "opus")
        #expect(fixture.launchedEffort(1) == "low")
    }

    /// An external Session keeps `unknown`: Argo did not start it, so there is no argv to read and
    /// nothing to state until a record says something.
    @Test
    func `an external Session reads unknown`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }

        await hubObserveToEnd(fixture.hub, hubTestObservation(
            id: "session-from-cli",
            events: [.cwd(fixture.projectURL.path), .prompt(
                text: "Off you go",
                images: [],
                atMs: Date().epochMs,
            )],
        ))

        let session = try #require(fixture.hub.session(id: "session-from-cli"))
        #expect(session.model == nil)
        #expect(session.effort == nil)
    }
}
