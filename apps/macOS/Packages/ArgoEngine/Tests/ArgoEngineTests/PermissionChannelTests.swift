@testable import ArgoEngine
import Foundation
import Testing

/// The permission gate end to end: a spawn installs the hook, a gated call blocks the agent and
/// raises a Permission in the roster, and the user's answer goes back down the same socket as the
/// hook's decision.
///
/// Serialized, and not as a flake plaster. Every test here drives a `DispatchSource` on the MAIN
/// queue — a socket accepting, a connection reading a line — and waits on the main actor for it to
/// fire. Run in parallel they are a dozen waits sharing one runloop, and a wait long enough to
/// starve its own event handler fails as "the agent never asked", which is indistinguishable from
/// the bug these tests are for.
@Suite("Permission channel", .serialized)
@MainActor
struct PermissionChannelTests {
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
        try await PermissionGate.withGate { fixture, _, client in
            client.sendLine(PermissionGate.bashCall)
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
        try await PermissionGate.withGate { fixture, claim, client in
            client.sendLine(PermissionGate.bashCall)
            await settle { fixture.hub.sessions.first?.permission != nil }

            let waiting = try #require(fixture.hub.sessions.first?.permission)
            try fixture.hub.driver.decide(.allow, answering: waiting.id, for: claim.value)

            let answer = try await PermissionGate.word(read: client)

            #expect(answer == "allow")
            #expect(fixture.hub.sessions.first?.permission == nil)
            #expect(fixture.hub.sessions.first?.status != .permission)
        }
    }

    @Test
    func `a deny goes back down the hook as a denial`() async throws {
        try await PermissionGate.withGate { fixture, claim, client in
            client.sendLine(PermissionGate.bashCall)
            await settle { fixture.hub.sessions.first?.permission != nil }

            let waiting = try #require(fixture.hub.sessions.first?.permission)
            try fixture.hub.driver.decide(.deny, answering: waiting.id, for: claim.value)

            let answer = try await PermissionGate.word(read: client)

            #expect(answer == "deny")
            #expect(fixture.hub.sessions.first?.permission == nil)
        }
    }

    @Test
    func `answering one call does not answer the next one for the same tool`() async throws {
        try await PermissionGate.withGate { fixture, claim, client in
            client.sendLine(PermissionGate.bashCall)
            await settle { fixture.hub.sessions.first?.permission != nil }
            let waiting = try #require(fixture.hub.sessions.first?.permission)
            try fixture.hub.driver.decide(.allow, answering: waiting.id, for: claim.value)
            _ = try await PermissionGate.decision(read: client)

            // A plain allow is spent on the call it was given for: nothing about it stands, so the
            // same command asked again is asked again. The standing answer is `allowAlways`, and
            // it is a separate control saying a separate sentence (#572).
            let second = try PermissionGate.dial(fixture, claim)
            defer { second.close() }
            second.sendLine(PermissionGate.bashCall)
            await settle { fixture.hub.sessions.first?.permission != nil }

            #expect(fixture.hub.sessions.first?.permission != nil)
            #expect(fixture.hub.sessions.first?.standingAllows.isEmpty == true)
        }
    }

    @Test
    func `a hook that expires unanswered takes its prompt with it`() async throws {
        try await PermissionGate.withGate { fixture, _, client in
            client.sendLine(PermissionGate.bashCall)
            await settle { fixture.hub.sessions.first?.permission != nil }

            client.close()
            await settle { fixture.hub.sessions.first?.permission == nil }

            #expect(fixture.hub.sessions.first?.permission == nil)
            #expect(fixture.hub.sessions.first?.status != .permission)
        }
    }

    @Test
    func `a request the gate cannot read is denied, never left to freeze the turn`() async throws {
        try await PermissionGate.withGate { fixture, _, client in
            client.sendLine("not json")

            let answer = try await PermissionGate.word(read: client)

            #expect(answer == "deny")
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
        try await PermissionGate.withGate { fixture, claim, client in
            client.sendLine(PermissionGate.bashCall)
            await settle { fixture.hub.sessions.first?.permission != nil }
            let displayed = try #require(fixture.hub.sessions.first?.permission)

            // A second call arrives behind the first, then the first's hook goes with its own
            // turn — the window in which a positional answer would spend the user's Allow on the
            // newcomer, which is a command they never read.
            let second = try PermissionGate.dial(fixture, claim)
            defer { second.close() }
            second.sendLine(PermissionGate.bashCall)
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
}
