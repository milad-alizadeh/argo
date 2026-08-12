@testable import ArgoEngine
import Foundation
import Testing

/// Driving a Codex Session through the port the cockpit talks to (#548). The process is the only
/// stand-in — the claim, the ownership registry, the launch and the adapter choice are real, so the
/// whole path from a Session id to a JSON-RPC line is covered.
@Suite("Codex drive")
@MainActor
struct CodexDriveTests {
    @Test
    func `a Codex spawn starts the app-server and no terminal`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }

        try await fixture.hub.spawnSession(cli: .codex)

        let launch = try #require(fixture.host.launches.last)
        #expect(launch.executablePath.hasSuffix("/codex"))
        #expect(launch.arguments == ["app-server"])
    }

    @Test
    func `a Turn typed at the composer reaches the Codex thread`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let session = try await fixture.openCodexSession()

        try fixture.hub.driver.send("Fix the caption, not the sort.", to: session.id)

        #expect(session.server.turns.count == 1)
        #expect(
            session.server.turns.first?["input"]?.array.first?.stringField("text")
                == "Fix the caption, not the sort.",
        )
    }

    /// The seed's prompt is the first Turn rather than a positional argument, because app-server
    /// takes no prompt on argv.
    @Test
    func `a Session seeded with a prompt opens on it as its first Turn`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let session = try await fixture.openCodexSession(seed: SessionSeed(opening: "Start here"))

        #expect(session.server.turns.count == 1)
        #expect(
            session.server.turns.first?["input"]?.array.first?.stringField("text") == "Start here",
        )
    }

    @Test
    func `an interrupt stops the Turn the thread is running`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let session = try await fixture.openCodexSession()
        try fixture.hub.driver.send("Write me an essay", to: session.id)
        session.server.started(turn: "turn-7")

        try fixture.hub.driver.interrupt(session.id)

        #expect(session.server.request("turn/interrupt")?.params.stringField("turnId") == "turn-7")
    }

    /// One Turn carries the words and the files: the paths are named in the text as they are on
    /// `claude`, and an image is handed to the server besides.
    @Test
    func `a Turn with an attachment names its path and carries the picture`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let session = try await fixture.openCodexSession()
        let shot = SessionAttachment.pastedImage(Data([0x89, 0x50]), fileExtension: "png")

        try fixture.hub.driver.send("What is wrong here?", attaching: [shot], to: session.id)

        let input = session.server.turns.first?["input"]?.array ?? []
        let words = try #require(input.first?.stringField("text"))
        #expect(words.hasPrefix("What is wrong here?"))
        #expect(words.hasSuffix(".png"))
        #expect(input.last?.stringField("type") == "localImage")
    }

    @Test
    func `whitespace alone is not a Turn`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let session = try await fixture.openCodexSession()

        #expect(throws: SessionDriveError.nothingToSend) {
            try fixture.hub.driver.send("  \n\t ", to: session.id)
        }
        #expect(session.server.turns.isEmpty)
    }

    @Test
    func `an orphaned Codex Session refuses the Turn its live self would have taken`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let session = try await fixture.openCodexSession()
        fixture.host.endLastProcess(exitCode: 0)

        #expect(throws: SessionDriveError.notDrivable) {
            try fixture.hub.driver.send("Carry on", to: session.id)
        }
    }

    /// The adapter is chosen on the Session and not at the surface: the same call on the same port
    /// reaches keystrokes on one Session and JSON-RPC on the other.
    @Test
    func `a Claude Session and a Codex one are driven from the one port`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claude = try await fixture.hub.spawnSession(cli: .claude)
        let claudeProcess = try #require(fixture.host.started.last)
        let codex = try await fixture.openCodexSession()

        try fixture.hub.driver.send("Hello", to: claude.value)
        try fixture.hub.driver.send("Hello", to: codex.id)

        #expect(claudeProcess.written.joined().hasSuffix("\r"))
        #expect(codex.server.turns.count == 1)
    }

    /// Until #549, an approval is declined where it arrives rather than raised — so there is never
    /// one waiting, and saying so is the honest answer.
    @Test
    func `there is no Permission to answer on a Codex Session yet`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let session = try await fixture.openCodexSession()

        #expect(throws: SessionDriveError.nothingPending) {
            try fixture.hub.driver.decide(.allow, answering: "permission-1", for: session.id)
        }
    }
}
