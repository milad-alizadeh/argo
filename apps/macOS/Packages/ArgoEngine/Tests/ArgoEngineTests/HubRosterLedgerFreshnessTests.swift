@testable import ArgoEngine
import Foundation
import Testing

/// The other half of `HubRosterFreshnessTests`: the inputs the fold reads off Argo's own ledgers
/// and off the Hub itself, rather than off the world.
///
/// Each case reads the roster BEFORE the change, so the memo is warm and holding an answer it has
/// to give up. Between them these five and that suite's four are every input `Hub.rosterStamp`
/// carries — the list is the stamp, and a fact that is in neither is one the cockpit could go on
/// drawing after it stopped being true.
@Suite("Hub roster ledger freshness")
@MainActor
struct HubRosterLedgerFreshnessTests {
    private static let cwd = "/tmp/argo-ledger-freshness"
    private static let sessionID = "ledger-freshness"

    @Test
    func `a claim opened over a Session the roster has drawn re-grades it`() async {
        let hub = await Self.hub()
        #expect(hub.sessions.first?.provenance == .external)

        _ = hub.ownership.claim(resuming: Self.sessionID)

        #expect(hub.sessions.first?.provenance == .managed)
    }

    @Test
    func `a fact filed against a claim reaches the row it is bound to`() async {
        let hub = await Self.hub()
        let claim = hub.ownership.claim(resuming: Self.sessionID)
        #expect(hub.sessions.first?.driveStatus == nil)

        hub.claims.publish(driveStatus: .running, for: claim)

        #expect(hub.sessions.first?.driveStatus == .running)
    }

    @Test
    func `a handoff recorded after the roster was read reaches it`() async {
        let hub = await Self.hub()
        #expect(hub.sessions.first?.handedOffTo == nil)

        hub.handoff.record(
            from: Self.sessionID,
            claim: SessionOwnership.ClaimID(value: "claim-99"),
            atMs: 1,
        )

        #expect(hub.sessions.first?.handedOffTo == "claim-99")
    }

    @Test
    func `a spawn published after the roster was read joins it`() async {
        let hub = await Self.hub()
        #expect(hub.sessions.count == 1)

        hub.spawns[Self.claim] = Self.spawn

        #expect(hub.sessions.count == 2)
        #expect(hub.sessions.contains { $0.id == Self.claim.value })
    }

    /// The Project is in the stamp because the spawned rows are scoped to it: they outlive a
    /// re-point and keep their PTYs, so nothing else takes them off the roster. `refreshCheckout`
    /// is where the Project moves without the join moving with it — git resolving the launch
    /// folder to a repository root somewhere else.
    @Test
    func `a Project resolved somewhere else drops the spawns that are not in it`() async {
        let checkout = CheckoutFixture()
        let hub = await Self.hub(checkout: checkout.read)
        hub.spawns[Self.claim] = Self.spawn
        #expect(hub.sessions.count == 2)

        // git resolving this Hub's launch folder to a repository root that does not hold it.
        await checkout.repository(
            at: URL(fileURLWithPath: "/tmp/argo-somewhere-else"),
            folders: [URL(fileURLWithPath: Self.cwd)],
        )
        await hub.refreshCheckout()

        #expect(hub.sessions.count == 1)
    }

    private static let claim = SessionOwnership.ClaimID(value: "claim-freshness")

    private static var spawn: AgentSpawn {
        AgentSpawn(claim: claim, cli: .claude, cwd: cwd, spawnedAtMs: 2000)
    }

    /// A Hub holding one observed Session, in this suite's folder, already read.
    private static func hub(
        checkout: @escaping CheckoutRead = CheckoutFixture().read,
    ) async
        -> Hub {
        let hub = testHub(projectURL: URL(fileURLWithPath: cwd), checkout: checkout)
        await hubObserveToEnd(hub, hubTestObservation(
            id: sessionID,
            events: [.cwd(cwd), .prompt(text: "Work", images: [], atMs: 1000)],
        ))
        return hub
    }
}
