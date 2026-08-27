@testable import ArgoEngine
import Foundation
import Testing

/// Whether a provider-port write may be attempted, which is a different question from whether the
/// last read landed.
///
/// The asymmetry is the whole suite: `stale` is Argo guessing, `needsReconnect` is Argo knowing.
/// Disabling on a guess asserts a fact — *this will fail* — that a failing read does not carry.
@Suite("Writes under a failing connection")
struct ConnectionWriteTests {
    private let binding = ProjectBinding(port: .workItem, accountID: "github:1", scope: "acme/api")
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

    /// The one place the escalation earns its promotion: there is no usable token, so the write
    /// provably cannot land.
    @Test
    func `a refused grant refuses writes`() {
        #expect(!BindingHealth(fault: .grantRefused, lastSuccess: now).admitsWrites)
    }

    /// End to end through the ledger, because the seam a caller actually holds is what it answers
    /// about a Binding — not a value handed to it.
    @Test
    func `a port whose reads are failing is still written through`() async {
        let ledger = ConnectionHealthLedger()
        await ledger.failed(binding, in: "P1", cause: .offline)

        #expect(await ledger.health(of: binding, in: "P1").admitsWrites)
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
