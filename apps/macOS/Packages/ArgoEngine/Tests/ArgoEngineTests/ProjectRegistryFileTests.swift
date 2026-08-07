@testable import ArgoEngine
import Foundation
import Testing

/// What the registry makes of the file it finds: a machine that never registered, a half-written
/// file, a hand-edit gone wrong. Every one of them has to be recoverable.
@Suite("Project registry file")
struct ProjectRegistryFileTests {
    @Test
    func `a registry file that cannot be read is an empty one`() async throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        try fixture.writeRegistryFile("{ \"projects\": [ ")

        let registry = await fixture.store().load()

        #expect(registry == .empty)
    }

    @Test
    func `a record carrying no path is dropped, the rest of the file still reading`() async throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        try fixture.writeRegistryFile("""
        {
          "activeProjectId": "kept",
          "projects": [{ "id": "broken" }, { "id": "kept", "path": "/tmp/kept" }]
        }
        """)

        let registry = await fixture.store().load()

        #expect(registry.projects.map(\.id) == ["kept"])
        #expect(registry.active?.path == "/tmp/kept")
    }

    @Test
    func `an active id no record carries reads as no active Project`() async throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        try fixture.writeRegistryFile("""
        { "activeProjectId": "gone", "projects": [{ "id": "kept", "path": "/tmp/kept" }] }
        """)

        let registry = await fixture.store().load()

        #expect(registry.projects.map(\.id) == ["kept"])
        #expect(registry.active == nil)
    }

    /// Registration is per machine and never committed, so the file it writes lives in application
    /// support rather than anywhere under a repository.
    @Test
    func `the registry is written to per-machine application support`() {
        let path = ProjectRegistryStore.defaultFileURL.path

        #expect(path.hasSuffix("/Argo/projects.json"))
        #expect(path.contains("Application Support"))
    }
}
