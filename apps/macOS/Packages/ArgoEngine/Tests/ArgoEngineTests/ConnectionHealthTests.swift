@testable import ArgoEngine
import Foundation
import Testing

/// The two levels a connection fails at, and the blast radius that tells them apart.
///
/// The account level is what this suite exists for. While a provider had one grant, "GitHub is
/// down" was one fact; a provider has N identities now, so the set a revoked grant takes with it is
/// **every Binding naming that Account** and nothing else — a strictly smaller and more honest set
/// than the old wording could express.
@Suite("Connection health")
struct ConnectionHealthTests {
    private let work = ProjectBinding(port: .workItem, accountID: "github:1", scope: "acme/api")
    private let personal = ProjectBinding(port: .workItem, accountID: "github:2", scope: "me/blog")
    private let now = Date(timeIntervalSince1970: 10000)

    @Test
    func `a connection nothing has reported on is healthy`() async {
        let health = await ConnectionHealthLedger().health(of: work, in: "P1")

        #expect(health.state == .healthy)
        #expect(health.level == nil)
    }

    @Test
    func `a read that did not land is stale at the binding level`() async {
        let ledger = ConnectionHealthLedger()
        await ledger.succeeded(work, in: "P1", at: now)
        await ledger.failed(work, in: "P1", cause: .rateLimited)

        let health = await ledger.health(of: work, in: "P1")

        #expect(health.state == .stale(.rateLimited))
        #expect(health.level == .binding)
        #expect(health.allowsWrites)
    }

    @Test
    func `a refused grant needs reconnecting, at the account level`() async {
        let ledger = ConnectionHealthLedger()
        await ledger.grantRefused("github:1")

        let health = await ledger.health(of: work, in: "P1")

        #expect(health.state == .needsReconnect)
        #expect(health.level == .account)
        #expect(!health.allowsWrites)
    }

    /// The correction the account level carries. Two Accounts of one provider are two grants, so a
    /// revocation of one is not a fact about the other — and reading it as one would take a
    /// personal-GitHub Project down because a work token expired.
    @Test
    func `a revoked account leaves another account of the same provider alone`() async {
        let ledger = ConnectionHealthLedger()
        await ledger.grantRefused("github:1")

        #expect(await ledger.health(of: work, in: "P1").state == .needsReconnect)
        #expect(await ledger.health(of: personal, in: "P2").state == .healthy)
    }

    /// The account level outranks the binding level because its fix is the other one's
    /// prerequisite: rebinding a scope through a token the provider has stopped accepting fails at
    /// bind time, so the row that says "reconnect" is the only one worth pressing.
    @Test
    func `a refused grant outranks a failing read on the same binding`() async {
        let ledger = ConnectionHealthLedger()
        await ledger.failed(work, in: "P1", cause: .offline)
        await ledger.grantRefused("github:1")

        #expect(await ledger.health(of: work, in: "P1").level == .account)
    }

    @Test
    func `reconnecting an account restores every binding that named it, in one act`() async {
        let ledger = ConnectionHealthLedger()
        let other = ProjectBinding(port: .codeHost, accountID: "github:1", scope: "acme/api")
        await ledger.grantRefused("github:1")

        await ledger.reconnected("github:1")

        #expect(await ledger.health(of: work, in: "P1").state == .healthy)
        #expect(await ledger.health(of: other, in: "P2").state == .healthy)
    }

    /// A read landing through the Account is proof the grant works, and proof outranks the record
    /// of a refusal. Without this the chip would stay lit through a token that started working
    /// again — which is a false claim in the one channel the user is meant to trust.
    @Test
    func `a read that lands clears the account fault it landed through`() async {
        let ledger = ConnectionHealthLedger()
        await ledger.grantRefused("github:1")

        await ledger.succeeded(work, in: "P1", at: now)

        #expect(await ledger.health(of: work, in: "P1").state == .healthy)
    }

    /// Staleness is a property of the connection, so a failed poll records itself on the connection
    /// and touches nothing that was fetched. The last-good reading is what the age is measured
    /// from, and clearing it would make an hour-old connection read as one that was never up.
    @Test
    func `a failed poll leaves the last good reading intact`() async {
        let ledger = ConnectionHealthLedger()
        await ledger.succeeded(work, in: "P1", at: now)

        await ledger.failed(work, in: "P1", cause: .unreachable)
        let health = await ledger.health(of: work, in: "P1")

        #expect(health.lastSuccess == now)
        #expect(health.age(asOf: now.addingTimeInterval(240)) == 240)
    }

    @Test
    func `health is keyed by binding, so one port failing leaves the other reading`() async {
        let ledger = ConnectionHealthLedger()
        let codeHost = ProjectBinding(port: .codeHost, accountID: "github:1", scope: "acme/api")
        await ledger.failed(work, in: "P1", cause: .unreachable)

        #expect(await ledger.health(of: codeHost, in: "P1").state == .healthy)
    }

    @Test
    func `the same port of another project keeps its own health`() async {
        let ledger = ConnectionHealthLedger()
        await ledger.failed(work, in: "P1", cause: .offline)

        #expect(await ledger.health(of: work, in: "P2").state == .healthy)
    }

    /// A missing folder is project integrity and has no cause word here. One repair with two
    /// vocabularies is the thing this list is short to prevent.
    @Test
    func `the cause vocabulary is the three words the spec settled`() {
        #expect(ConnectionCause.allCases.map(\.rawValue) == [
            "offline",
            "unreachable",
            "rateLimited",
        ])
    }
}
