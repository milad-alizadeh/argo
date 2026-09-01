@testable import ArgoEngine
import Foundation
import Testing

/// The permission gate with no call in flight: the plugin and hook a spawn installs before any
/// agent has asked anything, and the refusal the driver raises when an answer arrives with nothing
/// waiting.
///
/// Nothing here drives the socket, which is why it is not `.serialized` as
/// `PermissionChannelTests` is. Every case that does drive one belongs there.
@Suite("Permission gate wiring")
@MainActor
struct PermissionGateWiringTests {
    @Test
    func `a spawn installs the hook and loads the plugin that registers it`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }

        let claim = try await fixture.hub.spawnSession()
        let pluginRoot = fixture.pluginRoot(claim)
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
        #expect(hooks.contains("\"timeout\": \(PermissionPatience.hookTimeoutSeconds)"))
        #expect(hook.contains("\(claim.value).gate.sock"))
        #expect(!hook.contains("__ARGO_PERMISSION_SOCKET__"))
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
}
