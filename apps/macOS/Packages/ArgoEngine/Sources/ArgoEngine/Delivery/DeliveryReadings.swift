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
    @ObservationIgnored private let watch: (any CodeHostWatch)?
    @ObservationIgnored private let sleep: PortPollLoop.Sleeper
    @ObservationIgnored private var projectID: String?
    /// How many reads have been raised, so the newest one is the only one that publishes.
    @ObservationIgnored private var reads = 0
    /// Lazy because its local half reads this object, which does not exist while `init` runs.
    @ObservationIgnored private lazy var poll = DeliveryPoll(
        derivation: derivation,
        locally: { [weak self] in await self?.locally() ?? .init(workspaces: []) },
        sleep: sleep,
    )
    /// The fast path, where the code host offers one. Lazy for the poll's reason, and absent rather
    /// than idle where no watch was given: a build with no socket runs exactly the poll it always
    /// did.
    @ObservationIgnored private lazy var socket = watch.map { watch in
        DeliverySocket(
            watch: watch,
            // The poll's own derivation, so a fact the socket heard about is recorded exactly as a
            // polled one is — health and landing included.
            derive: { [weak self] target in await self?.poll.derive(target) },
            // The reading #1643 asked for: a dial that never opens is otherwise indistinguishable,
            // from inside this box, from one that is working.
            reportDialFailure: { [weak self] target, _ in
                await self?.derivation.dialFailed(target)
            },
            sleep: sleep,
        )
    }

    /// `health` is the ledger the connection chip already reads, so a failed derivation reports
    /// itself where every other port's failure does. `port`, `watch` and `sleep` are the seams a
    /// suite replaces; the app takes all three defaults.
    ///
    /// A `nil` watch is the socket switched off, which is the shape every claim about the poll is
    /// measured against — with one, the poll is unchanged and the socket only derives sooner.
    public init(
        health: ConnectionHealthLedger,
        port: CodeHostPort = GitHubDeliveries(),
        watch: (any CodeHostWatch)? = GitHubDeliveryWatch(),
        sleep: @escaping PortPollLoop.Sleeper = { try await Task.sleep(for: $0) },
    ) {
        self.derivation = DeliveryDerivation(port: port, health: health, deliveries: ledger)
        self.watch = watch
        self.sleep = sleep
    }

    /// Point the derivation at a Project, or at none. Called from every act that could have moved
    /// the code host Binding; re-pointing at an unchanged one costs nothing.
    public func point(_ resolution: BindingResolution, at projectID: String?) async {
        self.projectID = projectID
        await poll.report(to: { [weak self] in await self?.read() })
        await poll.point(resolution, at: projectID)
        await socket?.point(resolution, at: projectID)
    }

    /// The local half of one derivation, asked for at the moment of the tick. No assertion is
    /// folded in, because nothing pins a pull request to a branch by hand yet.
    private func locally() -> DeliveryDerivation.Locally {
        DeliveryDerivation.Locally(workspaces: workspaces())
    }

    /// Take what the ledger holds for the Project the loop is pointed at. A Project nothing has
    /// derived for reads EMPTY rather than keeping the last one's Deliveries.
    ///
    /// Published only when publishing would change the answer. `deliveries` is observed and the
    /// `Scene` body reads it, so an unconditional write rebuilds the whole shell on every tick with
    /// nothing on screen moving — which is #858, one poll over.
    ///
    /// And only by the NEWEST read, because two are live on any rebind: the landing a tick raised
    /// and the one `point` raises itself. Both suspend on the ledger, and the older one resuming
    /// last would publish what the ledger held before the tick recorded anything — a row losing its
    /// pull request until a later tick happened to derive an unequal set.
    private func read() async {
        reads += 1
        let read = reads
        let landed = await ledger.deliveries(of: projectID)
        guard read == reads, landed != deliveries else { return }
        deliveries = landed
    }
}
