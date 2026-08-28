import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// Folding one port's two sources: what the registries SHOW about the row, and what a read
/// RECORDED in the ledger. The poll that fills the second half is #388's.
@Suite("Port connection fold")
struct PortConnectionFoldTests {
    private let account = AccountRecord(
        provider: .github,
        providerAccountID: "1",
        displayName: "work",
    )
    private let lastSuccess = Date(timeIntervalSince1970: 10000)

    private func fold(_ state: ConnectPortState, observed: BindingHealth) -> PortConnection {
        PortConnection(
            port: ConnectPort(port: .ticket, state: state),
            account: account,
            observed: observed,
        )
    }

    @Test
    func `a port nothing is wrong with reports what the ledger recorded`() {
        let connection = fold(
            .bound(accountID: "github:1", scope: "acme/api"),
            observed: BindingHealth(fault: .read(.rateLimited), lastSuccess: lastSuccess),
        )

        #expect(connection.health.state == .stale(.rateLimited))
        #expect(connection.health.level == .binding)
    }

    @Test
    func `a grant the registries show as gone outranks whatever a read reported`() {
        // Account-level, and the prerequisite of every other failure: there is no token left to
        // read a scope with, so `stale` here would name a repair that cannot work.
        let connection = fold(
            .broken(accountID: "github:1", scope: "acme/api", fault: .grantExpired),
            observed: BindingHealth(fault: .read(.unreachable), lastSuccess: lastSuccess),
        )

        #expect(connection.health.level == .account)
    }

    @Test
    func `a derived fault keeps the last success the ledger holds`() {
        // The two facts outlive each other in opposite directions: a success survives every later
        // failure, so a chip under an expired grant can still say how long ago it last read.
        let connection = fold(
            .broken(accountID: "github:1", scope: "acme/api", fault: .grantMissing),
            observed: BindingHealth(fault: nil, lastSuccess: lastSuccess),
        )

        #expect(connection.health.lastSuccess == lastSuccess)
    }

    @Test
    func `a row whose Account was removed is a decision to remake, not a connection`() {
        // The panel's own row says so with a fix. Routing it into the chip as well would give one
        // repair two voices.
        let connection = fold(
            .broken(accountID: "github:1", scope: "acme/api", fault: .accountRemoved),
            observed: .healthy,
        )

        #expect(connection.health.state == .healthy)
    }

    @Test
    func `the port and the identity travel with the fold`() {
        // "GitHub needs reconnecting" was a complete sentence while a provider had one grant on a
        // machine; with two it names neither the thing that broke nor the thing to press.
        let connection = fold(.bound(accountID: "github:1", scope: "acme/api"), observed: .healthy)

        #expect(connection.port == .ticket)
        #expect(connection.account == account)
    }
}
