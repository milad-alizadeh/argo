@testable import ArgoEngine
import Foundation
import Testing

/// `working…` off the channel Argo owns (#1048).
///
/// For a managed Session, Argo performed the submit and holds the PTY it went down, so a Turn is a
/// thing it WITNESSED rather than a thing the 5-second liveness poll has to corroborate. Every
/// suite here runs on a machine with no agent process on it at all — so the reading being asserted
/// cannot be the DERIVED one, which would read `idle` throughout.
///
/// The claim has three ends, one per test below, and it has to: a Turn opened on Argo's own act and
/// closed by nothing would stand over an agent that finished hours ago (#585).
@Suite("Hub submitted turn")
@MainActor
struct HubSubmittedTurnTests {
    /// The window the original report was about: the prompt is gone and the answer has not started,
    /// and until #1048 nothing said the agent was thinking.
    @Test
    func `a Turn Argo typed reads running before any record has caught up`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        // The CLI is up, so the row is past `starting` and back to idle.
        try #require(fixture.host.started.last).emit("\u{1B}[?1049h")

        try fixture.hub.driver.send("Fix the caption, not the sort.", to: claim.value)

        #expect(fixture.hub.session(id: claim.value)?.statusReading
            == SessionStatusReading(tier: .direct, status: .running))
    }

    /// The record catching up does not weaken the claim. It is the same Turn, and the poll that
    /// would have had to corroborate it has still not run.
    @Test
    func `the record opening the Turn leaves it Argo's own claim`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let session = try await Self.boundSession(of: fixture)

        try fixture.hub.driver.send("Fix the caption, not the sort.", to: spawnedSessionID)
        session.yield([.prompt(text: "Fix the caption, not the sort.", images: [], atMs: 2000)])

        await hubSettle { fixture.hub.session(id: spawnedSessionID)?.events.count == 4 }
        #expect(fixture.hub.session(id: spawnedSessionID)?.statusReading
            == SessionStatusReading(tier: .direct, status: .running))
    }

    /// The first of the three ends, and the ordinary one: the CLI's own record says the Turn is
    /// over, and Argo stops claiming it is running.
    @Test
    func `the record saying the Turn ended takes the claim back`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let session = try await Self.boundSession(of: fixture)
        try fixture.hub.driver.send("Fix the caption, not the sort.", to: spawnedSessionID)

        session.yield([
            .prompt(text: "Fix the caption, not the sort.", images: [], atMs: 2000),
            .turnEnded(.endTurn),
        ])

        await hubSettle { fixture.hub.session(id: spawnedSessionID)?.status == .idle }
    }

    /// The second end. A Return the file-mention popup ate leaves the record exactly as it was, so
    /// nothing in it will ever close this Turn — the delivery watch is what bounds the claim, and
    /// the words go back to the composer rather than the row going on working (#682).
    @Test
    func `a Turn the CLI never heard stops being reported as running`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        try #require(fixture.host.started.last).emit("\u{1B}[?1049h")
        try fixture.hub.driver.send("what is @README.md about?", to: claim.value)

        fixture.hub.rememberLostTurn("what is @README.md about?", for: claim.value)

        #expect(fixture.hub.session(id: claim.value)?.status == .idle)
    }

    /// The third end, and the one no record and no watch can report: the process behind the PTY is
    /// gone, so there is no longer a channel the claim was witnessed on.
    @Test
    func `a process that goes takes the running claim with it`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        try #require(fixture.host.started.last).emit("\u{1B}[?1049h")
        try fixture.hub.driver.send("Fix the caption, not the sort.", to: claim.value)

        fixture.host.endLastProcess(exitCode: 0)

        #expect(fixture.hub.session(id: claim.value)?.status == .ended)
    }

    /// A spawned Session whose CLI has written a record, with the stream still open so a test can
    /// say what lands next. The claim binds to it on the chain uuid inside the path (#742).
    private static func boundSession(
        of fixture: SpawnFixture,
    ) async throws
        -> AsyncStream<[TranscriptEvent]>.Continuation {
        try await fixture.hub.spawnSession()
        let (observation, continuation) = hubLiveObservation(at: spawnedTranscriptURL)
        await fixture.hub.startObserving(observation)
        continuation.yield([
            .cwd(fixture.projectURL.path),
            .prompt(text: "First prompt", images: [], atMs: 1000),
            .turnEnded(.endTurn),
        ])
        await hubSettle { fixture.hub.session(id: spawnedSessionID)?.status == .idle }
        return continuation
    }
}
