@testable import ArgoEngine
import Foundation
import Testing

/// Whether a provider-port write may be attempted, which is a different question from whether the
/// last read landed.
@Suite("Writes under a failing connection")
struct ConnectionWriteTests {
    private let binding = ProjectBinding(port: .ticket, accountID: "github:1", scope: "acme/api")
    private let now = Date(timeIntervalSince1970: 10000)

    @Test
    func `a healthy connection admits writes`() {
        #expect(BindingHealth.healthy.admitsWrites)
    }

    @Test(arguments: ConnectionCause.allCases)
    func `a stale connection still admits writes`(cause: ConnectionCause) {
        let health = BindingHealth(fault: .read(cause), lastSuccess: now)

        #expect(health.state == .stale(cause))
        #expect(health.admitsWrites)
    }

    @Test
    func `a refused grant refuses writes`() {
        #expect(!BindingHealth(fault: .grantRefused, lastSuccess: now).admitsWrites)
    }

    @Test
    func `reconnecting an account admits its writes again`() async {
        let ledger = ConnectionHealthLedger()
        await ledger.grantRefused(binding.accountID)
        #expect(await !ledger.health(of: binding, in: "P1").admitsWrites)

        await ledger.reconnected(binding.accountID)

        #expect(await ledger.health(of: binding, in: "P1").admitsWrites)
    }
}
