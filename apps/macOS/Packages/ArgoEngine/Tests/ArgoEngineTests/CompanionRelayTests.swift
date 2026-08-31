@testable import ArgoEngine
import Foundation
import Testing

/// The link every other companion test skips: the RELAY.
///
/// The plugin does not connect to Argo's socket itself — it declares an MCP server whose command is
/// `/usr/bin/nc -U <socket>`, and the CLI speaks stdio to that. Every other test here connects with
/// a Swift socket, which proves the server and not the path the plugin actually takes. This drives
/// the real `nc`, over the real socket, with the real declaration's arguments.
@Suite("Companion relay")
@MainActor
struct CompanionRelayTests {
    @Test(.timeLimit(.minutes(1)))
    func `the relay the plugin declares reaches the channel`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        let relay = try Self.relay(to: fixture, claim: claim)
        defer { relay.terminate() }

        try Self.send(
            CompanionClient.toolCall(
                id: 1,
                name: "report_status",
                arguments: ["status": "running"],
            ),
            through: relay,
        )
        await settle { fixture.hub.sessions.first?.convention?.status != nil }

        #expect(fixture.hub.sessions.first?.status == .running)
    }

    /// `nc` invoked exactly as the materialized `.mcp.json` says to invoke it — read back off the
    /// file rather than repeated here, so a change to the declaration fails this test.
    private static func relay(to fixture: SpawnFixture, claim: SessionOwnership.ClaimID) throws
        -> Process {
        let declaration = try String(
            contentsOf: fixture.pluginRoot(claim).appending(path: ".mcp.json"),
            encoding: .utf8,
        )
        let server = try #require(JSONValue.record(fromLine: declaration))
        let argo = try #require(server["mcpServers"]?["argo"])
        let relay = Process()
        relay.executableURL = try URL(fileURLWithPath: #require(argo.stringField("command")))
        relay.arguments = argo["args"]?.array.compactMap(\.string)
        relay.standardInput = Pipe()
        relay.standardOutput = Pipe()
        try relay.run()
        return relay
    }

    private static func send(_ message: [String: Any], through relay: Process) throws {
        let line = try #require(CompanionResponse.line(message))
        let input = try #require(relay.standardInput as? Pipe)
        try input.fileHandleForWriting.write(contentsOf: Data((line + "\n").utf8))
    }
}
