@testable import ArgoEngine
import Foundation
import Testing

/// Choosing a provider per Project, per port — the act that is not authorizing.
@Suite("Project bindings")
struct ProjectBindingTests {
    @Test
    func `a Project holds at most one Binding per port`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let projectID = try await fixture.project("argo")
        try await fixture.accountStore().authorizeGitHub(id: "1")
        let bindings = fixture.bindings()

        try await bindings.bind(.gitHub(port: .workItem, scope: "milad/argo"), to: projectID)
        try await bindings.bind(.gitHub(port: .codeHost, scope: "milad/argo"), to: projectID)
        try await bindings.bind(.gitHub(port: .workItem, scope: "milad/cockpit"), to: projectID)

        let project = try #require(await fixture.projects.store().load().project(id: projectID))
        #expect(project.bindings.count == 2)
        #expect(project.binding(on: .workItem)?.scope == "milad/cockpit")
        #expect(project.binding(on: .codeHost)?.scope == "milad/argo")
    }

    /// The per-port half of the split: one GitHub Account normally fills both, and nothing in the
    /// model says it has to.
    @Test
    func `rebinding one port leaves the other Binding alone`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let projectID = try await fixture.project("argo")
        let store = fixture.accountStore()
        try await store.authorizeGitHub(id: "1", login: "personal")
        try await store.authorizeGitHub(id: "2", login: "work", token: "ghu_work")
        let bindings = fixture.bindings()
        try await bindings.bind(.gitHub(port: .workItem, account: "github:1"), to: projectID)
        try await bindings.bind(.gitHub(port: .codeHost, account: "github:1"), to: projectID)

        try await bindings.bind(.gitHub(port: .workItem, account: "github:2"), to: projectID)

        let project = try #require(await fixture.projects.store().load().project(id: projectID))
        #expect(project.binding(on: .workItem)?.accountID == "github:2")
        #expect(project.binding(on: .codeHost)?.accountID == "github:1")
    }

    @Test
    func `unbinding one port leaves the other Binding alone`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let projectID = try await fixture.project("argo")
        try await fixture.accountStore().authorizeGitHub(id: "1")
        let bindings = fixture.bindings()
        try await bindings.bind(.gitHub(port: .workItem), to: projectID)
        try await bindings.bind(.gitHub(port: .codeHost), to: projectID)

        await bindings.unbind(port: .workItem, from: projectID)

        let project = try #require(await fixture.projects.store().load().project(id: projectID))
        #expect(project.binding(on: .workItem) == nil)
        #expect(project.binding(on: .codeHost) != nil)
    }

    /// Two Projects, two providers, each reading through its own — the thing a machine-wide current
    /// provider could not express.
    @Test
    func `two Projects can be bound to different providers`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let cockpit = try await fixture.project("cockpit")
        let engine = try await fixture.project("engine")
        let store = fixture.accountStore()
        try await store.authorizeGitHub(id: "1")
        try await store.authorizeLinear(id: "u_9", token: "lin_work")
        let bindings = fixture.bindings()

        try await bindings.bind(.gitHub(port: .workItem, scope: "milad/cockpit"), to: cockpit)
        try await bindings.bind(
            ProjectBinding(port: .workItem, accountID: "linear:u_9", scope: "TEAM-1"),
            to: engine,
        )

        #expect(await fixture.provider(of: cockpit) == .github)
        #expect(await fixture.provider(of: engine) == .linear)
    }

    /// The case the Account level exists for: a personal and a work GitHub, one machine, no
    /// crossing over.
    @Test
    func `two Projects on two Accounts of one provider read through their own token`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let personal = try await fixture.project("personal-app")
        let work = try await fixture.project("work-app")
        let store = fixture.accountStore()
        try await store.authorizeGitHub(id: "1", login: "milad", token: "ghu_personal")
        try await store.authorizeGitHub(id: "2", login: "milad-at-work", token: "ghu_work")
        let bindings = fixture.bindings()
        try await bindings.bind(.gitHub(account: "github:1", scope: "milad/app"), to: personal)
        try await bindings.bind(.gitHub(account: "github:2", scope: "acme/app"), to: work)

        #expect(await fixture.token(of: personal) == "ghu_personal")
        #expect(await fixture.token(of: work) == "ghu_work")
    }

    /// Authorizing is once per identity per machine; choosing is per Project. So the second Project
    /// asks the provider whether the Account can see its scope, and asks for no new grant.
    @Test
    func `binding a second Project needs no second grant`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let first = try await fixture.project("first")
        let second = try await fixture.project("second")
        let api = StubProviderAPI(body: #"{ "full_name": "milad/app" }"#)
        let store = fixture.accountStore()
        try await store.authorizeGitHub(id: "1", token: "ghu_personal")
        let bindings = fixture.bindings(scopeCheck: ProviderScopeCheck(transport: api))
        try await bindings.bind(.gitHub(scope: "milad/app"), to: first)

        try await bindings.bind(.gitHub(scope: "milad/app"), to: second)

        // Every device-flow request goes to one of GitHub's OAuth endpoints; the only thing binding
        // ever asks for is the repository, twice, with the token the machine already held.
        let repositoryURL = "https://api.github.com/repos/milad/app"
        #expect(await api.urls() == [repositoryURL, repositoryURL])
        #expect(await api.bearerTokens() == ["ghu_personal", "ghu_personal"])
        #expect(await store.load().accounts.count == 1)
    }
}
