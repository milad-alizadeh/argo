@testable import ArgoEngine
import Testing

@Suite("Project agent launches")
@MainActor
struct ProjectAgentSpawnTests {
    @Test(arguments: AgentCLI.allCases)
    func `new Sessions use the app-wide harness`(agent: AgentCLI) async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        SessionRunStore(fileURL: fixture.runFileURL).rememberHarness(agent)
        _ = try await fixture.hub.spawnSession()
        let launch = try #require(fixture.host.launches.last)
        #expect(launch.executablePath.hasSuffix("/" + agent.command))
    }

    @Test
    func `a handoff successor uses the app-wide harness`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        SessionRunStore(fileURL: fixture.runFileURL).rememberHarness(.codex)
        _ = try await fixture.hub.spawn(.unseeded)
        let launch = try #require(fixture.host.launches.last)
        #expect(launch.executablePath.hasSuffix("/codex"))
    }
}
