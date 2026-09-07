import Foundation

/// The repeating derivation of one Project's Deliveries — the code host half of what a roster row
/// draws, and the only way the pull request behind a branch is ever current.
///
/// The Tickets poll's shape (`TicketPoll`): an actor over the shared `PortPollLoop`, so no request
/// and no decode runs on the MainActor and a Project that closes leaves nothing running behind it.
public actor DeliveryPoll {
    public typealias Landing = DeliveryDerivation.Landing
    /// The local half, asked for at the moment of the tick rather than held: branches are created
    /// and reaped while the loop runs, and a set captured when the Project opened would derive
    /// against a repository that has moved on.
    public typealias LocalRead = @Sendable () async -> DeliveryDerivation.Locally

    private let derivation: DeliveryDerivation
    private let locally: LocalRead
    private let sleep: PortPollLoop.Sleeper
    private var landed: Landing = {}
    /// Built lazily because its tick reads this actor, which does not exist while `init` runs.
    private lazy var loop = PortPollLoop(sleep: sleep) { [weak self] target in
        await self?.derive(target)
    }

    public init(
        derivation: DeliveryDerivation,
        locally: @escaping LocalRead,
        sleep: @escaping PortPollLoop.Sleeper = { try await Task.sleep(for: $0) },
    ) {
        self.derivation = derivation
        self.locally = locally
        self.sleep = sleep
    }

    /// Tell the poll who to raise on. Called before the first `point`, which is the only thing that
    /// starts a loop. The derivation is told too, so a landing reaches the shell whether it came
    /// from a tick or from the rebind below.
    public func report(to landed: @escaping Landing) async {
        self.landed = landed
        await derivation.report(to: landed)
    }

    /// A minute, the cadence the Tickets room already reads on. The host's hourly 5,000 is what
    /// stops the number being smaller, and a tick costs more than one request per branch: every
    /// pull request the tick touches costs TWO more, one for its check runs and one for its
    /// reviews.
    ///
    /// Counted rather than reasoned about, through `GitHubDeliveries` and its own paging rather
    /// than a fake port — `DeliveryTickCostTests`. The checkout is this repository's as #1619
    /// measured it: 80 worktree branches, 15 of them with a finished pull request and one open.
    ///
    /// | tick | requests | an hour |
    /// | --- | --- | --- |
    /// | before #1588, at 63 branches | 96 | 5,760 |
    /// | after #1604, at 63 branches | 50 | 3,000 |
    /// | the first tick of #1619, filling the ledger | 82 | — |
    /// | every tick after it | 3 | 180 |
    ///
    /// Three changes buy the difference. A finished pull request costs no check runs and no
    /// reviews; a branch already holding a finished Delivery is answered from the ledger; and a
    /// branch the host said it holds NOTHING for keeps that answer until its commit moves
    /// (`UnhostedBranches`). Only the third stops the number growing with the checkout — the other
    /// two left ~46 of 50 requests buying the same empty answer every minute, one more per worktree
    /// the checkout collected. What is left is the open listing plus two per open pull request, and
    /// neither of those counts worktrees.
    ///
    /// The Tickets poll spends a measured 30 a tick on the same grant, so the pair now cost 33 a
    /// tick against the host's hourly 5,000. Conditional requests are the lever left, and out of
    /// scope here.
    public static let interval = Duration.seconds(60)

    /// Point at whatever a Project reads its code host through, or stop. What each resolution
    /// means is `PortPollLoop.point`'s: a Project with no code host Binding derives nothing, and
    /// its ledger stays empty rather than holding an invented Delivery per branch.
    ///
    /// It raises the landing on every path, the two that change nothing included: a rebind moves
    /// which set the reader should be holding without a tick having happened.
    public func point(_ resolution: BindingResolution, at projectID: String?) async {
        await loop.point(resolution, at: projectID, every: Self.interval)
        await landed()
    }

    public func stop() async {
        await loop.stop()
    }

    /// One derivation. Public because a Delivery strip's Refresh is the same act as a tick, and two
    /// paths to it would be two chances to record health differently.
    public func derive(_ target: PortReadTarget) async {
        await derivation.derive(target, locally: locally())
    }
}
