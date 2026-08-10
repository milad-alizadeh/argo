@testable import ArgoEngine
import Foundation
import Testing

/// What is actually on disk, read back as bytes rather than as the type that wrote it — the only
/// way to check the claim that matters here, which is that the token is not among them.
@Suite("Account registry file")
struct AccountRegistryFileTests {
    @Test
    func `the token never reaches the registry file`() async throws {
        let fixture = try AccountFixture()
        defer { fixture.remove() }

        try await fixture.store().authorize(
            AccountFixture.github(id: "1", login: "milad"),
            grant: AccountGrant(accessToken: "ghu_secret_value", scopes: ["repo"]),
        )

        let written = try fixture.readRegistryFile()
        #expect(written.contains("milad"))
        #expect(written.contains("ghu_secret_value") == false)
    }

    @Test
    func `the grant is held under the Account's own key`() async throws {
        let fixture = try AccountFixture()
        defer { fixture.remove() }

        try await fixture.store().authorizeGitHub(id: "42")

        #expect(await fixture.grants.accountIDs() == ["github:42"])
    }

    @Test
    func `a registry file that cannot be read is an empty one`() async throws {
        let fixture = try AccountFixture()
        defer { fixture.remove() }
        try fixture.writeRegistryFile("{ \"accounts\": [ ")

        #expect(await fixture.store().load() == .empty)
    }

    @Test
    func `a record carrying no provider id is dropped, the rest of the file still reading`(
    ) async throws {
        let fixture = try AccountFixture()
        defer { fixture.remove() }
        try fixture.writeRegistryFile("""
        { "accounts": [
          { "provider": "github", "displayName": "broken" },
          { "provider": "github", "providerAccountID": "1", "displayName": "milad" }
        ] }
        """)

        let registry = await fixture.store().load()

        #expect(registry.accounts.map(\.id) == ["github:1"])
    }

    /// Two records for one identity is the state nothing downstream has a way back out of: two
    /// keychain keys collide on one entry, and a Binding naming the id cannot say which it meant.
    @Test
    func `a hand-edited file holding one identity twice reads as one Account`() async throws {
        let fixture = try AccountFixture()
        defer { fixture.remove() }
        try fixture.writeRegistryFile("""
        { "accounts": [
          { "provider": "github", "providerAccountID": "1", "displayName": "first" },
          { "provider": "github", "providerAccountID": "1", "displayName": "second" }
        ] }
        """)

        let registry = await fixture.store().load()

        #expect(registry.accounts.map(\.displayName) == ["first"])
    }

    /// A grant is per machine and never committed, so the file it writes lives in application
    /// support, beside the Project registry rather than anywhere under a repository.
    @Test
    func `the registry is written to per-machine application support`() {
        let path = AccountRegistryStore.defaultFileURL.path

        #expect(path.hasSuffix("/Argo/accounts.json"))
        #expect(path.contains("Application Support"))
    }
}
