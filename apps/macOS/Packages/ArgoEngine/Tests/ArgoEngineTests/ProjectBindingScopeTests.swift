@testable import ArgoEngine
import Foundation
import Testing

/// Asking what an Account could be bound to, through `ProjectBindings` — the offer side of `bind`,
/// and the read the panel's repository picker is drawn from (#821).
@Suite("Project binding scopes")
struct ProjectBindingScopeTests {
    @Test
    func `the provider's listing reaches the caller`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        try await fixture.accountStore().authorizeGitHub(id: "1")
        await fixture.catalog.answer(.listed(["milad/argo"], truncated: false))

        let catalogue = await fixture.bindings()
            .scopes(on: .ticket, through: "github:1")

        #expect(catalogue == .listed(["milad/argo"], truncated: false))
    }

    /// The port travels with the question because it is part of it: one repository can be visible
    /// and still have Issues switched off, and only the provider can say.
    @Test
    func `the port is part of what the provider is asked`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        try await fixture.accountStore().authorizeGitHub(id: "1")

        _ = await fixture.bindings().scopes(on: .codeHost, through: "github:1")

        #expect(await fixture.catalog.questions() == [.codeHost])
    }

    /// An Account nobody holds is not a provider failure, and it is certainly not an empty listing:
    /// the picker would send the user looking for a repository that was never on offer.
    @Test
    func `an account this Mac does not hold is refused before any provider is asked`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }

        let catalogue = await fixture.bindings()
            .scopes(on: .ticket, through: "github:404")

        guard case .unreadable = catalogue else {
            Issue.record("an unheld account listed scopes: \(catalogue)")
            return
        }
        #expect(await fixture.catalog.questions().isEmpty)
    }

    /// A provider that cannot fill the port is refused here for the same reason `bind` refuses it:
    /// the only outcome of offering it is that refusal, one screen later.
    @Test
    func `an account whose provider cannot fill the port is never asked`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        try await fixture.accountStore().authorizeLinear(id: "1", token: "lin_api")

        let catalogue = await fixture.bindings()
            .scopes(on: .codeHost, through: "linear:1")

        guard case .unreadable = catalogue else {
            Issue.record("Linear offered scopes for the code host: \(catalogue)")
            return
        }
    }

    /// A listed Account with no usable token is an Account-level failure — the repair is
    /// authorizing again, which is what `unauthorized` sends the picker to.
    @Test
    func `an account with no grant left is unauthorized rather than empty`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        try await fixture.accountStore().authorizeGitHub(id: "1")
        await fixture.accounts.grants.removeGrant(for: "github:1")

        let catalogue = await fixture.bindings()
            .scopes(on: .ticket, through: "github:1")

        #expect(catalogue == .unauthorized)
    }
}
