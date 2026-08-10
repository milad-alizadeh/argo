@testable import ArgoEngine
import Foundation
import Testing

/// What a completed grant makes of the machine's set of identities: a provider has N Accounts, and
/// which one you are is the provider's id for you, not the name it renders.
@Suite("Account registry")
struct AccountRegistryTests {
    @Test
    func `completing a grant adds an Account`() async throws {
        let fixture = try AccountFixture()
        defer { fixture.remove() }

        let registry = try await fixture.store().authorizeGitHub(id: "1")

        #expect(registry.accounts.map(\.displayName) == ["milad"])
    }

    @Test
    func `a second GitHub identity adds a second Account`() async throws {
        let fixture = try AccountFixture()
        defer { fixture.remove() }
        let store = fixture.store()

        try await store.authorizeGitHub(id: "1")
        let registry = try await store.authorizeGitHub(id: "2", login: "milad-at-work")

        #expect(registry.accounts(for: .github).map(\.displayName) == ["milad", "milad-at-work"])
    }

    @Test
    func `authorizing the same identity twice leaves one Account`() async throws {
        let fixture = try AccountFixture()
        defer { fixture.remove() }
        let store = fixture.store()

        try await store.authorizeGitHub(id: "1")
        let registry = try await store.authorizeGitHub(id: "1")

        #expect(registry.accounts.count == 1)
    }

    /// The point of keying on the provider's id: the login is a display attribute, exactly as a
    /// Project's path is, so a rename upstream re-labels the Account every Binding already names.
    @Test
    func `an identity renamed upstream keeps its Account and renders the new name`() async throws {
        let fixture = try AccountFixture()
        defer { fixture.remove() }
        let store = fixture.store()

        try await store.authorizeGitHub(id: "1", login: "milad")
        let registry = try await store.authorizeGitHub(id: "1", login: "milad-renamed")

        #expect(registry.accounts.map(\.id) == ["github:1"])
        #expect(registry.accounts.map(\.displayName) == ["milad-renamed"])
    }

    @Test
    func `re-authorizing an identity replaces the token it reads with`() async throws {
        let fixture = try AccountFixture()
        defer { fixture.remove() }
        let store = fixture.store()

        try await store.authorizeGitHub(id: "1", token: "ghu_first")
        try await store.authorizeGitHub(id: "1", token: "ghu_second")

        #expect(try await store.grant(for: "github:1")?.accessToken == "ghu_second")
    }

    @Test
    func `each Account reads with its own token`() async throws {
        let fixture = try AccountFixture()
        defer { fixture.remove() }
        let store = fixture.store()

        try await store.authorizeGitHub(id: "1", token: "ghu_personal")
        try await store.authorizeGitHub(id: "2", token: "ghu_work")

        #expect(try await store.grant(for: "github:1")?.accessToken == "ghu_personal")
        #expect(try await store.grant(for: "github:2")?.accessToken == "ghu_work")
    }

    /// Linear's lifecycle is the one this registry must already fit (#371): an expiring token with
    /// a refresh alongside it, through the same store and the same file, with nothing to migrate.
    @Test
    func `an expiring, refreshable grant is stored without a schema change`() async throws {
        let fixture = try AccountFixture()
        defer { fixture.remove() }
        let expiry = Date(timeIntervalSince1970: 2_000_000)
        let linear = AccountRecord(provider: .linear, providerAccountID: "u1", displayName: "milad")

        try await fixture.store().authorize(linear, grant: AccountGrant(
            accessToken: "lin_oauth",
            scopes: ["read", "issues:create"],
            lifetime: .expiring(at: expiry, refreshToken: "lin_refresh"),
        ))

        let stored = try await fixture.store().grant(for: "linear:u1")
        #expect(stored?.refreshToken == "lin_refresh")
        #expect(stored?.isExpired(asOf: expiry.addingTimeInterval(1)) == true)
    }

    @Test
    func `a non-expiring grant never reads as expired`() {
        let grant = AccountGrant(accessToken: "ghu_personal", scopes: GitHubOAuthApp.scopes)

        #expect(grant.isExpired(asOf: Date(timeIntervalSince1970: 4_000_000_000)) == false)
    }
}
