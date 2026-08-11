@testable import ArgoEngine
import Foundation
import Testing

/// What Bindings look like on disk: in the per-machine Project registry, never in the repo, and
/// readable by a build that predates them either way round.
@Suite("Project binding file")
struct ProjectBindingFileTests {
    @Test
    func `a Binding survives a reload`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let projectID = try await fixture.project("argo")
        try await fixture.accountStore().authorizeGitHub(id: "1")
        try await fixture.bindings().bind(.gitHub(scope: "milad/argo"), to: projectID)

        let reloaded = await ProjectRegistryStore(fileURL: fixture.projects.registryFileURL).load()

        let binding = try #require(reloaded.binding(on: .workItem, of: projectID))
        #expect(binding.accountID == "github:1")
        #expect(binding.scope == "milad/argo")
    }

    /// The registry file holds the Account's id and nothing else about it. The token is the
    /// keychain's, and a file in application support that carried one would undo the reason the
    /// two are separate.
    @Test
    func `the registry file records the Account id and no token`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let projectID = try await fixture.project("argo")
        try await fixture.accountStore().authorizeGitHub(id: "1", token: "ghu_personal")
        try await fixture.bindings().bind(.gitHub(), to: projectID)

        let contents = try fixture.projects.readRegistryFile()

        #expect(contents.contains("github:1"))
        #expect(!contents.contains("ghu_personal"))
    }

    /// Every `projects.json` written before Bindings existed carries no `bindings` key. Decoding
    /// has to treat that as an unbound Project rather than as an unreadable record, which the
    /// lenient array above it would turn into a machine that forgot every Project it had.
    @Test
    func `a registry file written before Bindings existed still reads`() async throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        try fixture.writeRegistryFile("""
        { "activeProjectId": "a", "projects": [{ "id": "a", "path": "/tmp/argo" }] }
        """)

        let registry = await fixture.store().load()

        #expect(registry.projects.map(\.id) == ["a"])
        #expect(registry.binding(on: .workItem, of: "a") == nil)
    }

    /// The same bargain the registry strikes for a record: one unreadable Binding leaves its port
    /// unbound — a state the cockpit already renders and the user can bind again — rather than
    /// costing the Project every Binding it had.
    @Test
    func `an unreadable Binding leaves its own port unbound`() async throws {
        let registry = try await Self.halfUnreadableRegistry()

        #expect(registry.binding(on: .workItem, of: "a") == nil)
    }

    @Test
    func `an unreadable Binding costs the Project none of its others`() async throws {
        let registry = try await Self.halfUnreadableRegistry()

        #expect(registry.binding(on: .codeHost, of: "a")?.scope == "milad/argo")
    }

    /// One Project, two Bindings, and only the second one decodable.
    private static func halfUnreadableRegistry() async throws -> ProjectRegistry {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        try fixture.writeRegistryFile("""
        { "activeProjectId": "a",
          "projects": [{ "id": "a", "path": "/tmp/argo", "bindings": [
            { "port": "workItem" },
            { "port": "codeHost", "accountID": "github:1", "scope": "milad/argo" }
          ] }] }
        """)
        return await fixture.store().load()
    }

    /// The path is an attribute and the id is the key, so a Project that moves keeps every choice
    /// made about it.
    @Test
    func `a Project that moves keeps its Bindings`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let projectID = try await fixture.project("argo")
        try await fixture.accountStore().authorizeGitHub(id: "1")
        try await fixture.bindings().bind(.gitHub(), to: projectID)

        let moved = try fixture.projects.folder("moved/argo", git: true)
        await fixture.projects.store().relocate(id: projectID, to: moved)

        let registry = await fixture.projects.store().load()
        #expect(registry.project(id: projectID)?.path == moved.path)
        #expect(registry.binding(on: .workItem, of: projectID)?.accountID == "github:1")
    }
}
