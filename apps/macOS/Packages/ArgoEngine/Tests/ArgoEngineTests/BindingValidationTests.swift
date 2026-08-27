@testable import ArgoEngine
import Foundation
import Testing

/// Bind time is the only moment "this Account cannot see that scope" and "that scope is empty" are
/// separable. Every test here is about refusing then, and writing nothing.
@Suite("Bind-time validation")
struct BindingValidationTests {
    @Test
    func `an Account that cannot see the scope is refused`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let projectID = try await fixture.project("argo")
        try await fixture.accountStore().authorizeGitHub(id: "1")
        await fixture.scopeCheck.answer(.notVisible, for: "acme/private")
        let bindings = fixture.bindings()

        await #expect(throws: BindingRefusal.scopeNotVisible("acme/private")) {
            try await bindings.bind(.gitHub(scope: "acme/private"), to: projectID)
        }
    }

    /// The half that matters after the refusal: a Binding recorded here would read empty forever,
    /// which is the state bind-time validation exists to prevent.
    @Test
    func `a refused bind writes nothing`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let projectID = try await fixture.project("argo")
        try await fixture.accountStore().authorizeGitHub(id: "1")
        await fixture.scopeCheck.answer(.notVisible, for: "acme/private")
        let bindings = fixture.bindings()

        _ = try? await bindings.bind(.gitHub(scope: "acme/private"), to: projectID)

        #expect(await fixture.projects.store().load().binding(on: .workItem, of: projectID) == nil)
    }

    /// A provider that cannot be reached has not said no. Refusing this attempt is right; recording
    /// the Binding anyway, or remembering a permanent refusal, would both claim more than was
    /// observed.
    @Test
    func `a provider that cannot be reached refuses the bind without a verdict`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let projectID = try await fixture.project("argo")
        try await fixture.accountStore().authorizeGitHub(id: "1")
        await fixture.scopeCheck.answer(.unreadable("offline"), for: "milad-alizadeh/argo")
        let bindings = fixture.bindings()

        await #expect(throws: BindingRefusal.unreadable("offline")) {
            try await bindings.bind(.gitHub(), to: projectID)
        }

        #expect(await fixture.projects.store().load().binding(on: .workItem, of: projectID) == nil)
    }

    @Test
    func `a revoked grant is refused at the Account level`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let projectID = try await fixture.project("argo")
        try await fixture.accountStore().authorizeGitHub(id: "1")
        await fixture.scopeCheck.answer(.unauthorized, for: "milad-alizadeh/argo")
        let bindings = fixture.bindings()

        await #expect(throws: BindingRefusal.unauthorized) {
            try await bindings.bind(.gitHub(), to: projectID)
        }
    }

    /// Linear sources intent and nothing else, so the code-host port is not a choice it can fill.
    /// Refused here rather than at the first read that answers nothing.
    @Test
    func `a Linear Account cannot fill the code host port`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let projectID = try await fixture.project("argo")
        try await fixture.accountStore().authorizeLinear(id: "u_9", token: "lin_work")
        let bindings = fixture.bindings()

        await #expect(throws: BindingRefusal.portNotServedByProvider(.linear, .codeHost)) {
            try await bindings.bind(
                ProjectBinding(port: .codeHost, accountID: "linear:u_9", scope: "TEAM-1"),
                to: projectID,
            )
        }
    }

    @Test
    func `binding names an Account this machine never authorized`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let projectID = try await fixture.project("argo")
        let bindings = fixture.bindings()

        await #expect(throws: BindingRefusal.noSuchAccount) {
            try await bindings.bind(.gitHub(), to: projectID)
        }
    }

    @Test
    func `binding a Project the registry does not hold`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        try await fixture.accountStore().authorizeGitHub(id: "1")
        let bindings = fixture.bindings()

        await #expect(throws: BindingRefusal.noSuchProject) {
            try await bindings.bind(.gitHub(), to: "not-a-project")
        }
    }

    /// An Account listed with no token in the keychain — what a failed grant or a keychain reset
    /// leaves behind. There is nothing to validate with, so there is nothing to bind.
    @Test
    func `an Account with no token in the keychain cannot be bound`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let projectID = try await fixture.project("argo")
        let store = AccountRegistryStore(
            fileURL: fixture.accounts.registryFileURL,
            grants: UndeletableGrantStore(),
            bindings: ProjectBindingIndex(projects: fixture.projects.store()),
        )
        try await store.authorizeGitHub(id: "1")
        let bindings = ProjectBindings(
            projects: fixture.projects.store(),
            accounts: store,
            seams: BindingProviderSeams(
                scopeCheck: fixture.scopeCheck,
                catalog: fixture.catalog,
            ),
        )

        await #expect(throws: BindingRefusal.noGrant) {
            try await bindings.bind(.gitHub(), to: projectID)
        }
    }

    @Test
    func `an expired grant is refused rather than bound and left to fail later`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let projectID = try await fixture.project("argo")
        try await fixture.accountStore().authorize(
            AccountFixture.github(id: "1", login: "milad"),
            grant: AccountGrant(
                accessToken: "lin_stale",
                scopes: ["repo"],
                lifetime: .expiring(at: Date(timeIntervalSince1970: 0), refreshToken: nil),
            ),
        )
        let bindings = fixture.bindings()

        await #expect(throws: BindingRefusal.grantExpired) {
            try await bindings.bind(.gitHub(), to: projectID)
        }
    }
}
