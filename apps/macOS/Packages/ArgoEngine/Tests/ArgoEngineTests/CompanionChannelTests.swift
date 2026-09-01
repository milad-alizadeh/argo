@testable import ArgoEngine
import Foundation
import Testing

/// The companion-plugin channel end to end: a spawn opens a socket, writes a real `.claude-plugin`
/// pointing at it, and what arrives down it reaches the roster at the CONVENTION tier.
@Suite("Companion channel")
@MainActor
struct CompanionChannelTests {
    @Test
    func `a spawn writes a plugin whose MCP declaration names its own socket`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }

        let claim = try await fixture.hub.spawnSession()
        let pluginRoot = fixture.companionRoot.appending(path: claim.value)
        let mcpConfig = pluginRoot.appending(path: ".mcp.json")
        let manifest = pluginRoot.appending(path: ".claude-plugin/plugin.json")
        let declaration = try String(contentsOf: mcpConfig, encoding: .utf8)

        #expect(FileManager.default.fileExists(atPath: manifest.path))
        #expect(declaration.contains("\(claim.value).sock"))
        // The relay the declaration names has to BE there. It ships with macOS, which is why it is
        // the relay — and a plugin naming a program this Mac does not have fails silently inside
        // the CLI, where Argo never hears about it.
        #expect(FileManager.default.isExecutableFile(atPath: "/usr/bin/nc"))
        #expect(!declaration.contains(CompanionPlugin.socketPlaceholder))
        // On argv as well as on disk: the plugin is loadable today without a marketplace between
        // it and the spawn.
        let launch = try #require(fixture.host.launches.first)
        #expect(launch.arguments.contains(["--mcp-config", mcpConfig.path]))
        #expect(launch.environment["ARGO_COMPANION_SOCKET"]?
            .hasSuffix("\(claim.value).sock") == true)
    }

    @Test
    func `the channel answers an MCP handshake and lists its tools`() async throws {
        try await Self.withChannel { _, client in
            client.send(["jsonrpc": "2.0", "id": 1, "method": "initialize", "params": [:]])
            let handshake = try await Self.reply(to: client)
            client.send(["jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": [:]])
            let catalog = try await Self.reply(to: client)

            #expect(handshake["result"]?.stringField("protocolVersion") != nil)
            let tools = catalog["result"]?["tools"]?.array ?? []
            let names = tools.compactMap { $0.stringField("name") }
            #expect(Set(names) == Set(CompanionTool.allCases.map(\.rawValue)))
        }
    }

    @Test
    func `a reported status reaches the roster at the CONVENTION tier`() async throws {
        try await Self.withChannel { fixture, client in
            try await Self.report(client, "report_status", ["status": "running"])
            await settle { fixture.hub.sessions.first?.convention?.status != nil }

            let session = try #require(fixture.hub.sessions.first)
            let reading = SessionStatusReading(tier: .convention, status: .running)
            #expect(session.statusReading == reading)
        }
    }

    /// The degrade-down rule reaches the channel too: a word outside the vocabulary is `unknown`,
    /// never the nearest guess.
    @Test
    func `a status word the channel does not know reads unknown`() async throws {
        try await Self.withChannel { fixture, client in
            try await Self.report(client, "report_status", ["status": "vibing"])
            await settle { fixture.hub.sessions.first?.convention?.status != nil }

            #expect(fixture.hub.sessions.first?.status == .unknown)
        }
    }

    @Test
    func `a reported Outcome is kept verbatim against the Session`() async throws {
        try await Self.withChannel { fixture, client in
            try await Self.report(client, "report_outcome", [
                "target": "code",
                "reference": "abc1234",
                "summary": "Read the PTY",
            ])
            await settle { fixture.hub.sessions.first?.convention?.outcomes.isEmpty == false }

            let outcome = CompanionOutcome(
                target: .code,
                reference: "abc1234",
                summary: "Read the PTY",
            )
            #expect(fixture.hub.sessions.first?.convention?.outcomes == [outcome])
        }
    }

    @Test
    func `a tool call missing its required argument records nothing`() async throws {
        try await Self.withChannel { fixture, client in
            client.send(CompanionClient.toolCall(id: 1, name: "report_status", arguments: [:]))
            let reply = try await Self.reply(to: client)

            #expect(reply["result"]?["isError"]?.bool == true)
            #expect(fixture.hub.sessions.first?.convention == nil)
        }
    }

    /// A Session with no channel is `managed` with nothing at the CONVENTION tier — never demoted
    /// to external, because the posture is about the PTY and not about what the agent said.
    @Test
    func `a spawn whose agent never dials in stays managed with no CONVENTION facts`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }

        _ = try await fixture.hub.spawnSession()

        #expect(fixture.hub.sessions.map(\.provenance) == [.managed])
        #expect(fixture.hub.sessions.first?.convention == nil)
        #expect(fixture.hub.sessions.first?.statusReading.tier == .derived)
    }

    @Test
    func `the channel closes with the PTY`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        let socketPath = Self.socketPath(fixture, claim)

        fixture.host.endLastProcess(exitCode: 0)

        #expect(!FileManager.default.fileExists(atPath: socketPath))
        #expect(CompanionClient.dialledOnce(socketPath) == nil)
    }

    /// The whole point of retiring the reported status: a Session whose agent said `running` and
    /// whose PTY then exited must fall back to what the transcript says, not go on claiming at a
    /// tier whose channel has gone (#799).
    @Test
    func `a status reported before the PTY exited stops being read at CONVENTION`() async throws {
        try await Self.withChannel { fixture, client in
            try await Self.report(client, "report_status", ["status": "running"])
            // Required, not settled-and-forgotten: a status that never arrives would otherwise fail
            // below as "never degraded", sending the reader after the wrong bug.
            try #require(await settle { fixture.hub.sessions.first?.convention?.status != nil })

            fixture.host.endLastProcess(exitCode: 0)

            // NAMED, and that is load-bearing. Written as a second trailing closure over
            // `fixture` it compiles to the same closure entity as the wait above, so it re-tests
            // "a status arrived" — false the instant the exit retires it — and never settles. It
            // burnt its whole budget on the main actor every run, and the `#expect` below passed
            // regardless, which is why nothing ever reported it (#918).
            let degraded = { fixture.hub.sessions.first?.statusReading.tier == .derived }
            await settle(until: degraded)
            #expect(degraded())
        }
    }

    /// A spawned Session with a client on its channel, torn down after. A closure because `defer`
    /// cannot be lifted into a helper that returns.
    private static func withChannel(
        _ body: (SpawnFixture, CompanionClient) async throws -> Void,
    ) async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        let client = try await CompanionClient.dialled(socketPath(fixture, claim))
        defer { client.close() }
        try await body(fixture, client)
    }

    /// One tool call, answered — the shape every report below takes.
    private static func report(
        _ client: CompanionClient,
        _ name: String,
        _ arguments: [String: Any],
    ) async throws {
        client.send(CompanionClient.toolCall(id: 1, name: name, arguments: arguments))
        _ = try await reply(to: client)
    }

    private static func socketPath(
        _ fixture: SpawnFixture,
        _ claim: SessionOwnership.ClaimID,
    )
        -> String {
        fixture.companionRoot.appending(path: "\(claim.value).sock").path
    }

    /// Let the server's run loop turn, then read its answer. The socket is served on the main
    /// actor, so a test that read without yielding would read before anything was written.
    private static func reply(to client: CompanionClient) async throws -> JSONValue {
        await Task.yield()
        var reply: JSONValue?
        await settle {
            reply = client.receive()
            return reply != nil
        }
        return try #require(reply)
    }
}
