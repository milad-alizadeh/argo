@testable import ArgoEngine
import Testing

/// A Turn the CLI never heard, reaching the roster (#682).
///
/// The whole point of the fact is that it survives the re-key: a fresh Session is published under
/// its claim and renamed to the CLI's own id the moment a record lands, and news filed under the id
/// the row had at send time would be lost exactly when it mattered.
@Suite("Hub lost turn")
@MainActor
struct HubLostTurnTests {
    @Test
    func `a Session nobody lost a Turn at says nothing`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()

        #expect(fixture.hub.session(id: claim.value)?.lostTurn == nil)
    }

    /// What the watch files when it gives up, read back where the composer reads it.
    @Test
    func `a Turn the CLI never heard reaches the roster verbatim`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()

        fixture.hub.rememberLostTurn("what is @README.md about?", for: claim.value)

        #expect(fixture.hub.session(id: claim.value)?.lostTurn == "what is @README.md about?")
    }

    /// Taken back once the composer has the words: reported twice, a reader would put the same
    /// Turn back twice, and the second would land on the field the first one filled.
    @Test
    func `the news is spent once the composer has taken it in`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        fixture.hub.rememberLostTurn("Off you go.", for: claim.value)

        fixture.hub.clearLostTurn(for: claim.value)

        #expect(fixture.hub.session(id: claim.value)?.lostTurn == nil)
    }

    /// The re-key read from the OTHER side (#1176) — `Hub.recordCount(writtenBy:)` states the
    /// mechanism. One claim in one test because it is one claim: the answer has to be the SAME
    /// Session's under either id a first Turn can be watched at — the claim's, which is what the
    /// composer typed at before the record landed, and the transcript's, which is what the row
    /// answers to after.
    @Test
    func `the record count is one Session's under either of its ids`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        #expect(fixture.hub.recordCount(writtenBy: claim.value) == 0)

        try await Self.record(landsFor: fixture)

        let written = try #require(fixture.hub.session(id: spawnedSessionID)?.events.count)
        #expect(written > 0)
        #expect(fixture.hub.recordCount(writtenBy: claim.value) == written)
        #expect(fixture.hub.recordCount(writtenBy: spawnedSessionID) == written)
    }

    /// The count the WATCH holds, and not merely the resolution behind it: what made the Turn read
    /// as silence was this closure, and a test of `recordCount` alone would not notice it being
    /// pointed back at the row the re-key stands down.
    @Test
    func `the watch the Hub wired reads the re-keyed Session`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        let records = fixture.hub.delivery.watch.says.records

        try await Self.record(landsFor: fixture)

        let written = try #require(fixture.hub.session(id: spawnedSessionID)?.events.count)
        #expect(written > 0)
        #expect(records(claim.value) == written)
    }

    /// The composer reading the Hub WIRED (#1266), for the same reason the record count above is
    /// asserted through the watch: what tells a command the CLI took from a Turn it dropped is
    /// this closure reaching the claim's own PTY, and a test of `ComposerEcho` alone would not
    /// notice it pointed at another Session's screen — or at none.
    @Test
    func `the watch the Hub wired reads the composer at the claim's own PTY`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        let echo = fixture.hub.delivery.watch.says.echo

        try #require(fixture.host.started.last).emit("scrollback\n❯ /clear\n")
        #expect(echo("/clear", claim.value) == .unheard)

        try #require(fixture.host.started.last).emit("\n❯\n")
        #expect(echo("/clear", claim.value) == .heard)
    }

    /// A Turn nobody can retype is not news the composer could act on, so the PTY going has to
    /// drop the watch — and a first Turn is watched under the id it was typed at, which is the
    /// claim's (#1176). The record lands in between here, which is the whole hazard: from that
    /// moment the claim resolves to the transcript's id, and a `forget` that took only the
    /// RESOLVED id would leave this watch armed to report the Turn lost seconds later.
    @Test
    func `a PTY that goes drops the watch on a fresh Session's first Turn`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        try #require(fixture.host.started.last).emit("\u{1B}[?1049h")
        try fixture.hub.driver.send("what is @README.md about?", to: claim.value)
        try #require(fixture.hub.delivery.isWatching(claim.value))
        try await Self.record(landsFor: fixture)

        fixture.host.endLastProcess(exitCode: 0)

        #expect(!fixture.hub.delivery.isWatching(claim.value))
    }

    /// The CLI writing its first record, which is what re-keys the spawned row to the id the
    /// transcript names (#361).
    private static func record(landsFor fixture: SpawnFixture) async throws {
        let (observation, continuation) = hubLiveObservation(at: spawnedTranscriptURL)
        await fixture.hub.startObserving(observation)
        continuation.yield([
            .cwd(fixture.projectURL.path),
            .prompt(text: "Fix the caption, not the sort.", images: [], atMs: 1000),
            .turnEnded(.endTurn),
        ])
        await hubSettle { fixture.hub.session(id: spawnedSessionID)?.status == .idle }
    }

    /// A Session Argo holds no claim on is one it cannot type at, so there was never a Turn of
    /// ours to lose — and a fact filed against no claim would have nowhere to live.
    @Test
    func `a Session Argo never spawned files nothing`() throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }

        fixture.hub.rememberLostTurn("Are you there", for: "a-session-somebody-else-started")

        #expect(fixture.hub.session(id: "a-session-somebody-else-started") == nil)
    }
}
