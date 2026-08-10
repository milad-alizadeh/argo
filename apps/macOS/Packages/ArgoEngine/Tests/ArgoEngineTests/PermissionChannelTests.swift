@testable import ArgoEngine
import Foundation
import Testing

/// The permission gate end to end: a spawn installs the hook, a gated call blocks the agent and
/// raises a Permission in the roster, and the user's answer goes back down the same socket as the
/// hook's decision.
@Suite("Permission channel")
@MainActor
struct PermissionChannelTests {
    private static let bashCall = """
    {"tool_name":"Bash","tool_input":{"command":"rm -rf build"}}
    """

    @Test
    func `a spawn installs the hook and passes its settings on argv`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }

        let claim = try await fixture.hub.spawnSession()
        let pluginRoot = fixture.companionRoot.appending(path: claim.value)
        let settings = try String(
            contentsOf: pluginRoot.appending(path: "settings.json"),
            encoding: .utf8,
        )
        let hook = try String(
            contentsOf: pluginRoot.appending(path: "permission-hook.sh"),
            encoding: .utf8,
        )

        let launch = try #require(fixture.host.launches.first)
        #expect(launch.arguments.contains("--settings"))
        #expect(settings.contains("permission-hook.sh"))
        #expect(settings.contains("\"timeout\": \(PermissionChannel.patienceSeconds)"))
        #expect(hook.contains("\(claim.value).gate.sock"))
        #expect(!hook.contains("__ARGO_PERMISSION_SOCKET__"))
    }

    @Test
    func `a gated call raises a Permission and the Session reads it DIRECT`() async throws {
        try await withGate { fixture, _, client in
            client.sendLine(Self.bashCall)
            await settle { fixture.hub.sessions.first?.permission != nil }

            let session = try #require(fixture.hub.sessions.first)
            let request = try #require(session.permission)
            #expect(request.toolName == "Bash")
            #expect(request.target == .command("rm -rf build"))
            #expect(session.statusReading == SessionStatusReading(
                tier: .direct,
                status: .permission,
            ))
        }
    }

    @Test
    func `an allow goes back down the hook and clears the prompt`() async throws {
        try await withGate { fixture, claim, client in
            client.sendLine(Self.bashCall)
            await settle { fixture.hub.sessions.first?.permission != nil }

            try fixture.hub.driver.decide(.allow, for: claim.value)
            let decision = try await Self.decision(read: client)

            #expect(decision.stringField("permissionDecision") == "allow")
            #expect(fixture.hub.sessions.first?.permission == nil)
            #expect(fixture.hub.sessions.first?.status != .permission)
        }
    }

    @Test
    func `a deny goes back down the hook as a denial`() async throws {
        try await withGate { fixture, claim, client in
            client.sendLine(Self.bashCall)
            await settle { fixture.hub.sessions.first?.permission != nil }

            try fixture.hub.driver.decide(.deny, for: claim.value)
            let decision = try await Self.decision(read: client)

            #expect(decision.stringField("permissionDecision") == "deny")
            #expect(fixture.hub.sessions.first?.permission == nil)
        }
    }

    @Test
    func `always allow answers the next call for that tool with no prompt at all`() async throws {
        try await withGate { fixture, claim, client in
            client.sendLine(Self.bashCall)
            await settle { fixture.hub.sessions.first?.permission != nil }
            try fixture.hub.driver.decide(.allowAlways, for: claim.value)
            _ = try await Self.decision(read: client)

            let second = try #require(CompanionClient(socketPath: Self.gatePath(fixture, claim)))
            defer { second.close() }
            second.sendLine(Self.bashCall)
            let decision = try await Self.decision(read: second)

            #expect(decision.stringField("permissionDecision") == "allow")
            #expect(fixture.hub.sessions.first?.permission == nil)
        }
    }

    @Test
    func `a hook that expires unanswered takes its prompt with it`() async throws {
        try await withGate { fixture, _, client in
            client.sendLine(Self.bashCall)
            await settle { fixture.hub.sessions.first?.permission != nil }

            client.close()
            await settle { fixture.hub.sessions.first?.permission == nil }

            #expect(fixture.hub.sessions.first?.permission == nil)
            #expect(fixture.hub.sessions.first?.status != .permission)
        }
    }

    @Test
    func `a request the gate cannot read is denied, never left to freeze the turn`() async throws {
        try await withGate { fixture, _, client in
            client.sendLine("not json")
            let decision = try await Self.decision(read: client)

            #expect(decision.stringField("permissionDecision") == "deny")
            #expect(fixture.hub.sessions.first?.permission == nil)
        }
    }

    @Test
    func `a decision with nothing waiting is refused in the seam's words`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()

        #expect(throws: SessionDriveError.nothingPending) {
            try fixture.hub.driver.decide(.allow, for: claim.value)
        }
    }

    /// A spawned Session with a client dialled into its permission gate, torn down after.
    private func withGate(
        _ body: (SpawnFixture, SessionOwnership.ClaimID, CompanionClient) async throws -> Void,
    ) async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        let client = try #require(CompanionClient(socketPath: Self.gatePath(fixture, claim)))
        defer { client.close() }
        try await body(fixture, claim, client)
    }

    private static func gatePath(
        _ fixture: SpawnFixture,
        _ claim: SessionOwnership.ClaimID,
    )
        -> String {
        fixture.companionRoot.appending(path: "\(claim.value).gate.sock").path
    }

    /// The hook's decision object, unwrapped from the reply's envelope.
    private static func decision(read client: CompanionClient) async throws -> JSONValue {
        await Task.yield()
        var reply: JSONValue?
        await settle {
            reply = client.receive()
            return reply != nil
        }
        return try #require(reply?["hookSpecificOutput"])
    }
}
