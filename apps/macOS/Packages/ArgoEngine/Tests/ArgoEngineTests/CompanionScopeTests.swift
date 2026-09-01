@testable import ArgoEngine
import Foundation
import Testing

/// Two Hubs over one companion root (#987): two Argo processes on the default root, and the
/// `restarted` fixture these suites build.
///
/// Claim ids are minted per Hub, so the first claim of each is `claim-1`. What keeps their channels
/// apart is the corner of the root each Hub took, and this is what that corner buys: two gates
/// reachable AT ONCE, and a withdraw that cannot reach the other Hub's plugin.
@Suite("Two Hubs on one companion root", .serialized)
@MainActor
struct CompanionScopeTests {
    @Test
    func `two Hubs on one root each hold a reachable gate at the same time`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let other = fixture.restarted()
        let mine = try await fixture.hub.spawnSession()
        let theirs = try await other.spawnSession()
        #expect(mine.value == theirs.value, "both Hubs mint the same claim id")

        let myGate = PermissionGate.path(fixture, mine)
        let theirGate = PermissionGate.path(fixture, theirs, of: other)
        #expect(myGate != theirGate, "so only the Hub's own corner keeps the paths apart")
        let myHook = try await CompanionClient.dialled(myGate)
        defer { myHook.close() }
        let theirHook = try await CompanionClient.dialled(theirGate)
        defer { theirHook.close() }
        myHook.sendLine(PermissionGate.bashCall)
        theirHook.sendLine(PermissionGate.bashCall)

        // Each gate's own claim, so a reachable pair that answered to one Hub would fail here too.
        await settle {
            fixture.hub.facts(forClaim: mine).waiting.count == 1
                && other.facts(forClaim: theirs).waiting.count == 1
        }
    }

    @Test
    func `a withdraw on one Hub leaves the other Hub's plugin standing`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let other = fixture.restarted()
        let mine = try await fixture.hub.spawnSession()
        let theirs = try await other.spawnSession()
        let hook = fixture.pluginRoot(mine).appending(path: "permission-hook.sh")
        #expect(FileManager.default.fileExists(atPath: hook.path))

        other.companion?.withdraw(theirs)

        #expect(
            FileManager.default.fileExists(atPath: hook.path),
            "the other Hub's claim directory is not this Hub's to remove",
        )
    }
}
