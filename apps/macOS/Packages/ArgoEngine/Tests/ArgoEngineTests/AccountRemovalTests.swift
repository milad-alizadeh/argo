@testable import ArgoEngine
import Foundation
import Testing

/// Forgetting an identity: the token goes with it, and whatever was reading through it is named
/// rather than quietly left pointing at nothing.
@Suite("Account removal")
struct AccountRemovalTests {
    @Test
    func `removing an Account drops its token`() async throws {
        let fixture = try AccountFixture()
        defer { fixture.remove() }
        let store = fixture.store()
        try await store.authorizeGitHub(id: "1")

        try await store.remove(id: "github:1")

        #expect(await fixture.grants.accountIDs().isEmpty)
    }

    @Test
    func `removing an Account leaves the machine's other identities alone`() async throws {
        let fixture = try AccountFixture()
        defer { fixture.remove() }
        let store = fixture.store()
        try await store.authorizeGitHub(id: "1")
        try await store.authorizeGitHub(id: "2", token: "ghu_work")

        let removal = try await store.remove(id: "github:1")

        #expect(removal.registry.accounts.map(\.id) == ["github:2"])
        #expect(try await store.grant(for: "github:2")?.accessToken == "ghu_work")
    }

    @Test
    func `removing an Account reports the Bindings it would orphan`() async throws {
        let fixture = try AccountFixture(bindings: StubBindingIndex(bindings: [
            "github:1": [AccountBindingReference(projectID: "argo", port: .codeHost)],
        ]))
        defer { fixture.remove() }
        let store = fixture.store()
        try await store.authorizeGitHub(id: "1")

        let removal = try await store.remove(id: "github:1")

        #expect(removal.orphaned.map(\.projectID) == ["argo"])
        #expect(removal.orphaned.map(\.port) == [.codeHost])
    }

    /// The same question, asked before anything is removed — what a confirmation prompt needs in
    /// order to say what saying yes would cost.
    @Test
    func `what a removal would orphan can be asked without removing`() async throws {
        let fixture = try AccountFixture(bindings: StubBindingIndex(bindings: [
            "github:1": [AccountBindingReference(projectID: "argo", port: .workItem)],
        ]))
        defer { fixture.remove() }
        let store = fixture.store()
        try await store.authorizeGitHub(id: "1")

        let orphans = await store.orphans(of: "github:1")

        #expect(orphans.map(\.port) == [.workItem])
        #expect(await store.load().accounts.map(\.id) == ["github:1"])
    }

    /// A token Argo can no longer see is a token nobody can delete, so a keychain that refuses the
    /// deletion keeps the Account listed rather than losing the only handle on it.
    @Test
    func `an Account whose token cannot be dropped stays listed`() async throws {
        let fixture = try AccountFixture()
        defer { fixture.remove() }
        let store = fixture.store(grants: UndeletableGrantStore())
        try await store.authorizeGitHub(id: "1")

        await #expect(throws: UndeletableGrantStore.Refused.self) {
            try await store.remove(id: "github:1")
        }
        #expect(await store.load().accounts.map(\.id) == ["github:1"])
    }

    @Test
    func `removing an Account the machine never held changes nothing`() async throws {
        let fixture = try AccountFixture()
        defer { fixture.remove() }
        let store = fixture.store()
        try await store.authorizeGitHub(id: "1")

        let removal = try await store.remove(id: "github:9")

        #expect(removal.removed == nil)
        #expect(removal.registry.accounts.map(\.id) == ["github:1"])
    }
}
