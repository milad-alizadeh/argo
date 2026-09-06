import Foundation
import Observation

/// What the window holds about one Project's Deliveries (#1480): the ledger they land in, the loop
/// that fills it, and the value a surface draws.
///
/// Here rather than in the app target for ADR-0022's reason — the app holds observable boxes and
/// AppKit, and everything else is a derivation no test there can reach. A suite drives this one
/// with a fake `CodeHostPort` and a fake sleeper.
@MainActor
@Observable
public final class DeliveryReadings {
    /// What the code host last answered for each of the active Project's branches. Empty for a
    /// Project with no code host Binding: a row draws no pull request rather than one nobody read.
    public private(set) var deliveries: [Delivery] = []

    /// The branches the host's answer is joined against, injected because they are the Hub's git
    /// read. Unwired, the derivation still lands every pull request the host has in flight — it
    /// just knows of no branch beyond them.
    @ObservationIgnored public var workspaces: @MainActor () -> [WorkspaceProjection] = { [] }

    @ObservationIgnored private let ledger = DeliveryLedger()
    @ObservationIgnored private let derivation: DeliveryDerivation
    @ObservationIgnored private let sleep: PortPollLoop.Sleeper
    @ObservationIgnored private var projectID: String?
    /// Lazy because its local half reads this object, which does not exist while `init` runs.
    @ObservationIgnored private lazy var poll = DeliveryPoll(
        derivation: derivation,
        locally: { [weak self] in await self?.locally() ?? .init(workspaces: []) },
        sleep: sleep,
    )

    /// `health` is the ledger the connection chip already reads, so a failed derivation reports
    /// itself where every other port's failure does. `port` and `sleep` are the two seams a suite
    /// replaces; the app takes both defaults.
    public init(
        health: ConnectionHealthLedger,
        port: CodeHostPort = GitHubDeliveries(),
        sleep: @escaping PortPollLoop.Sleeper = { try await Task.sleep(for: $0) },
    ) {
        self.derivation = DeliveryDerivation(port: port, health: health, deliveries: ledger)
        self.sleep = sleep
    }

    /// Point the derivation at a Project, or at none. Called from every act that could have moved
    /// the code host Binding; re-pointing at an unchanged one costs nothing.
    public func point(_ resolution: BindingResolution, at projectID: String?) async {
        self.projectID = projectID
        await poll.report(to: { [weak self] in await self?.read() })
        await poll.point(resolution, at: projectID)
    }

    /// The local half of one derivation, asked for at the moment of the tick. No assertion is
    /// folded in, because nothing pins a pull request to a branch by hand yet.
    private func locally() -> DeliveryDerivation.Locally {
        DeliveryDerivation.Locally(workspaces: workspaces())
    }

    /// Take what the ledger holds for the Project the loop is pointed at. A Project nothing has
    /// derived for reads EMPTY rather than keeping the last one's Deliveries.
    private func read() async {
        deliveries = await ledger.deliveries(of: projectID)
    }
}
