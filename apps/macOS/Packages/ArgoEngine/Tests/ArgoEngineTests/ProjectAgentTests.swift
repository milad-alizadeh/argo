@testable import ArgoEngine
import Testing

@Suite("Project agent choice")
struct ProjectAgentTests {
    @Test(arguments: AgentCLI.allCases)
    func `the chosen Agent survives reopening the registry`(agent: AgentCLI) async throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        let first = try await fixture.store().register(at: fixture.folder("first"))
        let second = try await fixture.store().register(at: fixture.folder("second"))
        let project = try #require(first.project)
        _ = await fixture.store().chooseAgent(agent, for: project.id)
        let reopened = await fixture.store().load()
        #expect(reopened.project(id: project.id)?.agent == agent)
        #expect(reopened.project(id: second.project?.id)?.agent == .claude)
    }

    @Test
    func `a registry from before the Agent choice still opens with Claude Code`() async throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        try fixture.writeRegistryFile("""
        { "projects": [{ "id": "old", "path": "/tmp/project" }] }
        """)
        let reopened = await fixture.store().load()
        #expect(reopened.project(id: "old")?.agent == .claude)
    }

    @Test
    func `relocating a Project preserves its chosen Agent`() async throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        let created = try await fixture.store().register(at: fixture.folder("first"))
        let project = try #require(created.project)
        _ = await fixture.store().chooseAgent(.codex, for: project.id)
        let moved = try await fixture.store().relocate(id: project.id, to: fixture.folder("moved"))
        #expect(moved.project?.agent == .codex)
    }
}
