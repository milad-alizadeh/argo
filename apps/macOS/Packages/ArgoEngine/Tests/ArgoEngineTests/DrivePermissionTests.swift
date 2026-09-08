@testable import ArgoEngine
import Testing

@Suite("Drive Permission")
@MainActor
struct DrivePermissionTests {
    @Test
    func `a second choice starts from the exact adapter value just selected`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession(seed: SessionSeed(mode: .code))

        _ = try await fixture.hub.driver.setPermission("manual", for: claim.value)
        #expect(fixture.hub.driver.surface(of: claim.value).permission?.selectedID == "manual")
        #expect(fixture.hub.sessions.first?.mode == .nearly(.readOnly, cli: "manual"))
        await hubObserveToEnd(fixture.hub, hubTestObservation(
            id: "session-from-cli",
            events: [.cwd(fixture.projectURL.path), .mode(cli: "default")],
        ))
        #expect(fixture.hub.sessions.first?.modeDidNotTake == nil)
        _ = try await fixture.hub.driver.setPermission("acceptEdits", for: "session-from-cli")

        // `acceptEdits → manual` is three steps and `manual → acceptEdits` is one. Collapsing Ask
        // to Plan would make the second walk three steps and land on Auto.
        #expect(fixture.host.started.last?.written.count == 4)
    }
}
