@testable import ArgoEngine
import Foundation
import Testing

/// Reading a port back: what it is bound to, what it is not bound to at all, and what it is bound
/// to that has since come undone. Three answers, never two.
@Suite("Binding resolution")
struct BindingResolutionTests {
    /// The state a fully-onboarded machine reaches whenever a Project simply has no Ticket
    /// provider — "no Tickets", not a failure and not a first launch.
    @Test
    func `an unbound port is not an error`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let projectID = try await fixture.project("argo")
        try await fixture.accountStore().authorizeGitHub(id: "1")
        let bindings = fixture.bindings()
        try await bindings.bind(.gitHub(port: .codeHost), to: projectID)

        let resolution = await bindings.resolve(port: .ticket, for: projectID)

        guard case .unbound = resolution else {
            Issue.record("expected an unbound port, got \(resolution)")
            return
        }
    }

    @Test
    func `a Project the registry does not hold has no Binding to resolve`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }

        let resolution = await fixture.bindings().resolve(port: .ticket, for: "not-a-project")

        guard case .unbound = resolution else {
            Issue.record("expected an unbound port, got \(resolution)")
            return
        }
    }

    /// Removing an Account (#566) must leave what named it honest and re-bindable. Not `unbound`,
    /// which would read as a Project that never chose, and not an empty list of tickets.
    @Test
    func `a Binding whose Account was removed reads as broken, not as empty`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let projectID = try await fixture.project("argo")
        let store = fixture.accountStore()
        try await store.authorizeGitHub(id: "1")
        let bindings = fixture.bindings()
        try await bindings.bind(.gitHub(), to: projectID)

        try await store.remove(id: "github:1")

        let resolution = await bindings.resolve(port: .ticket, for: projectID)
        guard case let .broken(binding, fault) = resolution else {
            Issue.record("expected a broken Binding, got \(resolution)")
            return
        }
        #expect(fault == .accountRemoved)
        #expect(binding.accountID == "github:1")
    }

    /// The Binding survives the removal, so re-binding is a choice about which identity to read
    /// through rather than a Project that has to be set up again.
    @Test
    func `a broken Binding is re-bindable to another Account`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let projectID = try await fixture.project("argo")
        let store = fixture.accountStore()
        try await store.authorizeGitHub(id: "1")
        try await store.authorizeGitHub(id: "2", login: "work", token: "ghu_work")
        let bindings = fixture.bindings()
        try await bindings.bind(.gitHub(account: "github:1"), to: projectID)
        try await store.remove(id: "github:1")

        try await bindings.bind(.gitHub(account: "github:2"), to: projectID)

        #expect(await fixture.token(of: projectID) == "ghu_work")
    }

    @Test
    func `removing an Account names every Project Binding that pointed at it`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let projectID = try await fixture.project("argo")
        let store = fixture.accountStore()
        try await store.authorizeGitHub(id: "1")
        let bindings = fixture.bindings()
        try await bindings.bind(.gitHub(port: .ticket), to: projectID)
        try await bindings.bind(.gitHub(port: .codeHost), to: projectID)

        let removal = try await store.remove(id: "github:1")

        #expect(removal.orphaned.map(\.projectID) == [projectID, projectID])
        #expect(Set(removal.orphaned.map(\.port)) == [.ticket, .codeHost])
    }

    /// `bind` refuses this, so a registry holding it was written by something else. Re-asked at
    /// read time because the file is not a trusted input — the alternative is reading Delivery
    /// truth off a Ticket provider.
    @Test
    func `a hand-written Binding to a port its provider cannot fill reads as broken`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let projectID = try await fixture.project("argo")
        try await fixture.accountStore().authorizeLinear(id: "u_9", token: "lin_work")
        await fixture.projects.store().bind(
            ProjectBinding(port: .codeHost, accountID: "linear:u_9", scope: "TEAM-1"),
            to: projectID,
        )

        let resolution = await fixture.bindings().resolve(port: .codeHost, for: projectID)

        guard case let .broken(_, fault) = resolution else {
            Issue.record("expected a broken Binding, got \(resolution)")
            return
        }
        #expect(fault == .portNotServedByProvider)
    }

    @Test
    func `a Binding whose token has expired reads as broken`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let projectID = try await fixture.project("argo")
        let store = fixture.accountStore()
        try await store.authorizeGitHub(id: "1")
        try await fixture.bindings().bind(.gitHub(), to: projectID)

        try await store.authorize(
            AccountFixture.github(id: "1", login: "milad"),
            grant: AccountGrant(
                accessToken: "ghu_stale",
                scopes: ["repo"],
                lifetime: .expiring(at: Date(timeIntervalSince1970: 0), refreshToken: nil),
            ),
        )

        let resolution = await fixture.bindings().resolve(port: .ticket, for: projectID)
        guard case let .broken(_, fault) = resolution else {
            Issue.record("expected a broken Binding, got \(resolution)")
            return
        }
        #expect(fault == .grantExpired)
    }
}
