@testable import ArgoEngine
import Foundation
import Testing

/// How far a revoked grant reaches, asked of the real registries rather than a stub.
///
/// The blast radius is the one line the account level rewrites: it was *every GitHub-bound project
/// at once*, and it is now every Binding naming that Account. The two only look alike on a machine
/// with one identity, which is why every test here has two.
@Suite("Connection blast radius")
struct ConnectionBlastRadiusTests {
    @Test
    func `a revoked grant reaches every Binding that names it, across Projects`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let store = fixture.accountStore()
        try await store.authorizeGitHub(id: "1")
        let bindings = fixture.bindings()
        let api = try await fixture.project("api")
        let cockpit = try await fixture.project("cockpit")
        try await bindings.bind(.gitHub(port: .workItem), to: api)
        try await bindings.bind(.gitHub(port: .codeHost), to: api)
        try await bindings.bind(.gitHub(port: .workItem), to: cockpit)

        let reached = await store.bindings(through: "github:1")

        #expect(Set(reached.map(\.projectID)) == [api, cockpit])
        #expect(reached.count == 3)
    }

    /// The correction, at the level it is actually observable. A personal-GitHub Project is not
    /// touched by a work-GitHub revocation, and nothing about the provider is what decides that —
    /// the identity is.
    @Test
    func `it stops at the Account, not at the provider`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let store = fixture.accountStore()
        try await store.authorizeGitHub(id: "1", login: "work", token: "ghu_work")
        try await store.authorizeGitHub(id: "2", login: "milad", token: "ghu_personal")
        let bindings = fixture.bindings()
        let work = try await fixture.project("work")
        let blog = try await fixture.project("blog")
        try await bindings.bind(.gitHub(account: "github:1"), to: work)
        try await bindings.bind(.gitHub(account: "github:2"), to: blog)

        let reached = await store.bindings(through: "github:1")

        #expect(reached.map(\.projectID) == [work])
    }

    /// Every Binding the radius names goes down together and comes back together, which is what
    /// "reconnecting is one act, not one per Project" means when there is more than one Project.
    @Test
    func `one reconnect restores every Binding the radius named`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let store = fixture.accountStore()
        try await store.authorizeGitHub(id: "1")
        let bindings = fixture.bindings()
        let api = try await fixture.project("api")
        let cockpit = try await fixture.project("cockpit")
        try await bindings.bind(.gitHub(port: .workItem), to: api)
        try await bindings.bind(.gitHub(port: .workItem), to: cockpit)
        let ledger = ConnectionHealthLedger()
        await ledger.grantRefused("github:1")

        await ledger.reconnected("github:1")

        for reference in await store.bindings(through: "github:1") {
            let health = await ledger.health(
                of: .gitHub(port: reference.port),
                in: reference.projectID,
            )
            #expect(health.state == .healthy)
        }
    }

    /// A Binding that cannot be read through because its token has gone is an account-level fact,
    /// and it is knowable from the registries alone — no poll has to fail first for the chip to be
    /// right about it.
    @Test
    func `an expired grant is an account-level connection fault`() {
        #expect(BindingFault.grantExpired.connectionFault == .grantRefused)
        #expect(BindingFault.grantMissing.connectionFault == .grantRefused)
    }

    /// A row pointing at an Account that is gone, or at a provider that cannot fill it, is a
    /// decision to remake — not a connection to wait on. The Connect panel already says so, and
    /// giving it a second voice in the chip would be the second failure language.
    @Test
    func `a misconfigured Binding is not a connection failure`() {
        #expect(BindingFault.accountRemoved.connectionFault == nil)
        #expect(BindingFault.portNotServedByProvider.connectionFault == nil)
    }
}
