@testable import ArgoEngine
import Foundation
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
}
