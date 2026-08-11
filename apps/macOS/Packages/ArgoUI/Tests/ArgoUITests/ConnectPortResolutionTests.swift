import ArgoEngine
@testable import ArgoUI
import Testing

/// The seam between what the engine resolves and what the panel draws. Its whole job is to answer
/// three cases as three, and to leave the token behind.
@Suite("Connect port resolution")
struct ConnectPortResolutionTests {
    @Test
    func `an unbound port carries no Account and no scope`() {
        let port = ConnectPort(port: .workItem, resolution: .unbound)

        #expect(port.state == .unbound)
        #expect(port.accountID == nil)
        #expect(port.scope == nil)
    }

    @Test
    func `a readable port carries the identity and the scope it reads through`() {
        let binding = ProjectBinding(
            port: .codeHost,
            accountID: ConnectFixture.personal.id,
            scope: "milad-alizadeh/argo",
        )
        let port = ConnectPort(port: .codeHost, resolution: .ready(ResolvedBinding(
            binding: binding,
            account: ConnectFixture.personal,
            grant: AccountGrant(accessToken: "gho_secret", scopes: ["repo"]),
        )))

        #expect(port.accountID == ConnectFixture.personal.id)
        #expect(port.scope == "milad-alizadeh/argo")
    }

    /// Never collapsed into `unbound`: a port whose choice has come undone is re-bindable, and
    /// saying so is what makes it so.
    @Test
    func `a broken port keeps what it was pointing at, and says what went wrong`() {
        let binding = ProjectBinding(
            port: .workItem,
            accountID: ConnectFixture.work.id,
            scope: "trili/cockpit",
        )
        let port = ConnectPort(port: .workItem, resolution: .broken(binding, .grantExpired))

        #expect(port.state == .broken(
            accountID: ConnectFixture.work.id,
            scope: "trili/cockpit",
            fault: .grantExpired,
        ))
    }
}
