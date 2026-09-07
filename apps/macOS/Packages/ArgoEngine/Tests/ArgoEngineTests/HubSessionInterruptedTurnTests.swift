@testable import ArgoEngine
import Testing

/// The row the ticket screenshotted, and the reading that takes the green mark off it (#1644).
///
/// Three of four roster rows drew `running` over Sessions nothing had run in for two hours. Each
/// record ended on an assistant record carrying `stop_reason: tool_use` with no result after it,
/// and none of them carried an interrupt marker at all — so #1189's reader had no sentence to read
/// and the premise it was built on, that the CLI files the act, does not hold for an interrupt
/// inside a tool call. What is left is Argo's own `ESC`, which is the one witnessed fact there is.
@MainActor
@Suite("Hub session interrupted turn")
struct HubSessionInterruptedTurnTests {
    /// The reported state, ended. `idle` and DIRECT: the process is up, its prompt is free, and the
    /// keystroke that freed it was Argo's own.
    @Test
    func `a Turn Argo stopped inside a tool call reads idle`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        try await Self.openToolCall(of: fixture)
        try #require(fixture.hub.session(id: spawnedSessionID)?.statusReading
            == SessionStatusReading(tier: .derived, status: .running))

        try fixture.hub.driver.interrupt(spawnedSessionID)

        #expect(fixture.hub.session(id: spawnedSessionID)?.statusReading
            == SessionStatusReading(tier: .direct, status: .idle))
    }

    /// The Session nothing has stopped, which is what the fix must leave alone: an open Turn over a
    /// process Argo holds the PTY to is the ordinary reading of a Session that IS working.
    @Test
    func `a Turn nobody stopped still reads running`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        try await Self.openToolCall(of: fixture)

        #expect(fixture.hub.session(id: spawnedSessionID)?.status == .running)
    }

    /// The claim is spent the moment the record answers it, exactly as a submission is. A prompt
    /// typed after the stop is a Turn again, and the reading is the record's from there on.
    @Test
    func `a prompt landing after the stop reads running again`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let session = try await Self.openToolCall(of: fixture)
        try fixture.hub.driver.interrupt(spawnedSessionID)
        try #require(fixture.hub.session(id: spawnedSessionID)?.status == .idle)

        session.yield([.prompt(text: "Try the other column.", images: [], atMs: 4000)])

        await hubSettle { fixture.hub.session(id: spawnedSessionID)?.events.count == 4 }
        #expect(fixture.hub.session(id: spawnedSessionID)?.statusReading
            == SessionStatusReading(tier: .derived, status: .running))
    }

    /// The path #1189 already reads, untouched. Where the CLI DOES write its sentence, the record
    /// closes the Turn itself and the reading is the record's — DERIVED, and no claim of Argo's
    /// needed to reach the same word.
    @Test
    func `the marker the CLI writes still ends the Turn on its own`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let session = try await Self.openToolCall(of: fixture)

        session.yield([.interrupted(atMs: 4000)])

        await hubSettle { fixture.hub.session(id: spawnedSessionID)?.events.count == 4 }
        #expect(fixture.hub.session(id: spawnedSessionID)?.statusReading
            == SessionStatusReading(tier: .derived, status: .idle))
    }

    /// The DIRECT precedence above it, kept. A Permission and a question are both hooks Argo holds
    /// BOTH ends of, and either is news the reader has to act on — an `ESC` sent before one was
    /// raised does not get to quiet it.
    @Test
    func `a Permission Argo is holding wins over the ESC`() {
        var session = Self.stopped()
        session.permission = PermissionRequest(
            id: "request-1",
            toolName: "Bash",
            target: .command("rm -rf build"),
        )

        #expect(session.statusReading == SessionStatusReading(tier: .direct, status: .permission))
    }

    /// And the CLI's own protocol, which outranks it for the reason it outranks a submission: the
    /// thread that reported is one Argo started and holds the pipe to, so it is answering about
    /// THIS Session rather than about a keystroke Argo remembers sending.
    @Test
    func `a status the CLI reported wins over the ESC`() {
        var session = Self.stopped()
        session.driveStatus = .running

        #expect(session.statusReading == SessionStatusReading(tier: .direct, status: .running))
    }

    /// A spawned Session whose record ends mid tool call, with the stream still open — the shape
    /// all three interrupted rows in the screenshot were in. Five records: the three the bind takes
    /// plus the call, which no outcome answers.
    @discardableResult
    private static func openToolCall(
        of fixture: SpawnFixture,
    ) async throws
        -> AsyncStream<[TranscriptEvent]>.Continuation {
        try await fixture.hub.spawnSession()
        let continuation = await hubFirstRecords([
            .prompt(text: "Fix the caption, not the sort.", images: [], atMs: 1000),
            .toolCall(ToolCall(
                id: "call-1",
                name: "Bash",
                kind: .execute,
                target: nil,
                atMs: 2000,
            )),
        ], landingFor: fixture)
        try #require(fixture.hub.session(id: spawnedSessionID)?.status == .running)
        return continuation
    }

    /// A Session carrying nothing but the `ESC`, for the precedence tests: no record has landed, so
    /// the claim stands, and whatever the reading is it is not this claim's doing.
    private static func stopped() -> HubSession {
        var session = HubSession(observation: hubTestObservation(id: "session", events: []))
        session.stopClaim = SessionStopClaim(recordsWhenStopped: 0)
        return session
    }
}
