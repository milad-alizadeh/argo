@testable import ArgoEngine
import Testing

@Suite("Legacy Project agent choice")
struct ProjectAgentTests {
    @Test func `a Project with a retired Agent choice keeps its identity`() async throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        try fixture.writeRegistryFile("""
        { "projects": [{ "id": "old", "path": "/tmp/project", "agent": "codex" }] }
        """)
        let reopened = await fixture.store().load()
        #expect(reopened.project(id: "old")?.path == "/tmp/project")
    }
}
