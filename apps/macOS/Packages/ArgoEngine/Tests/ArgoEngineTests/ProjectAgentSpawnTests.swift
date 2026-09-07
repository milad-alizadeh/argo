@testable import ArgoEngine
import Testing

@Suite("Project agent launches")
@MainActor
struct ProjectAgentSpawnTests {
    @Test(arguments: AgentCLI.allCases)
    func `new Sessions use the Project Agent`(agent: AgentCLI) async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        fixture.hub.agentForNewSession = { _ in agent }
        _ = try await fixture.hub.spawnSession()
        let launch = try #require(fixture.host.launches.last)
        #expect(launch.executablePath.hasSuffix("/" + agent.command))
    }

    @Test
    func `a handoff successor uses the Project Agent`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        fixture.hub.agentForNewSession = { _ in .codex }
        _ = try await fixture.hub.spawn(.unseeded)
        let launch = try #require(fixture.host.launches.last)
        #expect(launch.executablePath.hasSuffix("/codex"))
    }
}
