@testable import ArgoEngine
import Testing

/// What a Delivery derivation reports about its connection — the second of the two producers the
/// health chip waits on (#260).
@Suite("Delivery connection health")
struct DeliveryHealthTests {
    private static func healthAfter(
        _ answer: Result<[Delivery], ProviderFetchError>,
    ) async
        -> BindingHealth {
        let health = ConnectionHealthLedger()
        let target = PortReadTarget.codeHost()
        await DeliveryDerivation(
            port: ScriptedCodeHost([answer]),
            health: health,
            deliveries: DeliveryLedger(),
        )
        .derive(target, locally: .init(workspaces: []))
        return await health.health(of: target.projectBinding, in: target.projectID)
    }

    @Test
    func `a derivation that lands leaves the code host healthy`() async {
        #expect(await Self.healthAfter(.success([])).state == .healthy)
    }

    struct CauseCase: Sendable {
        let error: ProviderFetchError
        let state: ConnectionState
    }

    /// The three cause words, plus the refusal that is an Account-level fact rather than one of
    /// them.
    private static let causes = [
        CauseCase(error: .offline, state: .stale(.offline)),
        CauseCase(error: .unreachable, state: .stale(.unreachable)),
        CauseCase(error: .rateLimited, state: .stale(.rateLimited)),
        CauseCase(error: .grantRefused, state: .needsReconnect),
    ]

    @Test(arguments: causes)
    func `a failed derivation is recorded in the cause words`(_ example: CauseCase) async {
        #expect(await Self.healthAfter(.failure(example.error)).state == example.state)
    }

    @Test
    func `a refused branch read is reported even though the listing landed`() async {
        // The strip keeps what the listing established (#1546), and the dot beside it still says
        // the host refused half the read — a partial derivation is not a healthy one.
        let health = ConnectionHealthLedger()
        let target = PortReadTarget.codeHost()
        await DeliveryDerivation(
            port: ScriptedCodeHost([.success([])], refusing: ["worktree-1503-stale"]),
            health: health,
            deliveries: DeliveryLedger(),
        )
        .derive(target, locally: .init(workspaces: [.on("worktree-1503-stale")]))

        #expect(await health.health(of: target.projectBinding, in: "P1").state
            == .stale(.rateLimited))
    }

    @Test
    func `a refused grant takes every Binding on that Account with it`() async {
        // Account-level, so it is recorded once and the blast radius is derived — the same rule the
        // Ticket port records under, because one GitHub grant feeds both ports and fails as one.
        let health = ConnectionHealthLedger()
        let target = PortReadTarget.codeHost()
        await DeliveryDerivation(
            port: ScriptedCodeHost([.failure(.grantRefused)]),
            health: health,
            deliveries: DeliveryLedger(),
        )
        .derive(target, locally: .init(workspaces: []))
        let tickets = ProjectBinding(
            port: .ticket, accountID: target.accountID, scope: "acme/api",
        )

        #expect(await health.health(of: tickets, in: "P1").state == .needsReconnect)
    }

    /// #1643: a socket that never dialled is not something `derive` ever saw, so it is its own
    /// entry point onto this ledger rather than a shape `record` has to recognize.
    @Test
    func `a dial that never opened is readable off the health ledger`() async {
        let health = ConnectionHealthLedger()
        let target = PortReadTarget.codeHost()
        let derivation = DeliveryDerivation(
            port: ScriptedCodeHost([.success([])]),
            health: health,
            deliveries: DeliveryLedger(),
        )

        await derivation.dialFailed(target, error: ProviderFetchError.unreachable)

        #expect(await health.health(of: target.projectBinding, in: "P1")
            .state == .stale(.unreachable))
    }

    /// A dial refused for the grant's own reason is the Account failing, not the Binding — the same
    /// rule `record` already applies to a polled read (#1643).
    @Test
    func `a dial the grant itself refused reads as needing reconnect, not merely unreachable`(
    ) async {
        let health = ConnectionHealthLedger()
        let target = PortReadTarget.codeHost()
        let derivation = DeliveryDerivation(
            port: ScriptedCodeHost([.success([])]),
            health: health,
            deliveries: DeliveryLedger(),
        )

        await derivation.dialFailed(target, error: ProviderFetchError.grantRefused)

        #expect(await health.health(of: target.projectBinding, in: "P1").state == .needsReconnect)
    }

    /// #1698: the chip is the one place a user learns whether Argo can talk to a provider, so an
    /// error Argo raised itself must leave it saying nothing rather than saying the provider was
    /// asked and did not answer.
    @Test
    func `a dial refused from outside the transport records no cause at all`() async {
        let health = ConnectionHealthLedger()
        let target = PortReadTarget.codeHost()
        let derivation = DeliveryDerivation(
            port: ScriptedCodeHost([.success([])]),
            health: health,
            deliveries: DeliveryLedger(),
        )

        await derivation.dialFailed(target, error: OutsideTheTransport.raised)

        #expect(await health.health(of: target.projectBinding, in: "P1").state == .healthy)
    }

    /// The other half of that: recording nothing must not read as a read that landed either, or
    /// half a fan-out would go missing behind a chip claiming the whole of it (#1698).
    @Test
    func `a branch refused from outside the transport is not recorded as a read that landed`(
    ) async {
        let health = ConnectionHealthLedger()
        let target = PortReadTarget.codeHost()
        await DeliveryDerivation(
            port: ScriptedCodeHost(
                [.success([])], refusingUnclassified: ["worktree-1698-unnamed"],
            ),
            health: health,
            deliveries: DeliveryLedger(),
        )
        .derive(target, locally: .init(workspaces: [.on("worktree-1698-unnamed")]))

        #expect(await health.health(of: target.projectBinding, in: "P1").lastSuccess == nil)
    }
}
