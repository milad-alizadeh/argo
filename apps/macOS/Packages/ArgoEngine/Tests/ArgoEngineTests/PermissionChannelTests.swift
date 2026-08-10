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
    func `a spawn installs the hook and loads the plugin that registers it`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }

        let claim = try await fixture.hub.spawnSession()
        let pluginRoot = fixture.companionRoot.appending(path: claim.value)
        let hooks = try String(
            contentsOf: pluginRoot.appending(path: "hooks/hooks.json"),
            encoding: .utf8,
        )
        let hook = try String(
            contentsOf: pluginRoot.appending(path: "permission-hook.sh"),
            encoding: .utf8,
        )

        let launch = try #require(fixture.host.launches.first)
        // `--plugin-dir` and not `--settings`: a hook declared in a settings file passed on argv
        // is never registered, and an unregistered gate fails silently open.
        #expect(launch.arguments.contains("--plugin-dir"))
        #expect(hooks.contains("permission-hook.sh"))
        #expect(hooks.contains("\"timeout\": \(PermissionChannel.patienceSeconds)"))
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

            let waiting = try #require(fixture.hub.sessions.first?.permission)
            try fixture.hub.driver.decide(.allow, answering: waiting.id, for: claim.value)
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

            let waiting = try #require(fixture.hub.sessions.first?.permission)
            try fixture.hub.driver.decide(.deny, answering: waiting.id, for: claim.value)
            let decision = try await Self.decision(read: client)

            #expect(decision.stringField("permissionDecision") == "deny")
            #expect(fixture.hub.sessions.first?.permission == nil)
        }
    }

    @Test
    func `answering one call does not answer the next one for the same tool`() async throws {
        try await withGate { fixture, claim, client in
            client.sendLine(Self.bashCall)
            await settle { fixture.hub.sessions.first?.permission != nil }
            let waiting = try #require(fixture.hub.sessions.first?.permission)
            try fixture.hub.driver.decide(.allow, answering: waiting.id, for: claim.value)
            _ = try await Self.decision(read: client)

            // An allow is spent on the call it was given for. Nothing here remembers a tool as
            // blessed (#572), so the same command asked again is asked again.
            let second = try #require(CompanionClient(socketPath: Self.gatePath(fixture, claim)))
            defer { second.close() }
            second.sendLine(Self.bashCall)
            await settle { fixture.hub.sessions.first?.permission != nil }

            #expect(fixture.hub.sessions.first?.permission != nil)
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
            try fixture.hub.driver.decide(.allow, answering: "permission-1", for: claim.value)
        }
    }

    @Test
    func `an answer to a Permission that is no longer waiting reaches no other one`() async throws {
        try await withGate { fixture, claim, client in
            client.sendLine(Self.bashCall)
            await settle { fixture.hub.sessions.first?.permission != nil }
            let displayed = try #require(fixture.hub.sessions.first?.permission)

            // A second call arrives behind the first, then the first's hook goes with its own
            // turn — the window in which a positional answer would spend the user's Allow on the
            // newcomer, which is a command they never read.
            let second = try #require(CompanionClient(socketPath: Self.gatePath(fixture, claim)))
            defer { second.close() }
            second.sendLine(Self.bashCall)
            client.close()
            await settle {
                fixture.hub.sessions.first?.permission.map { $0.id != displayed.id } ?? false
            }

            #expect(throws: SessionDriveError.nothingPending) {
                try fixture.hub.driver.decide(.allow, answering: displayed.id, for: claim.value)
            }
            #expect(fixture.hub.sessions.first?.permission != nil)
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
