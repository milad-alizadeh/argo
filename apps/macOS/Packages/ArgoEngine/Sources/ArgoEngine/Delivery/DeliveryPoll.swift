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

    /// A minute, the cadence the Tickets room already reads on. What used to stop the number being
    /// smaller was the host's hourly 5,000: a tick costs more than one request per branch, since
    /// every LIVE pull request it touches costs TWO more, one for its check runs and one for its
    /// reviews.
    ///
    /// Counted rather than reasoned about, against this repository's own checkout — 77 worktree
    /// branches, 21 of them with a finished pull request and none open, so a settled tick is one
    /// open listing plus 56 branches asked about by name:
    ///
    /// | tick | requests | charged | an hour |
    /// | --- | --- | --- | --- |
    /// | before #1588, 63 branches | 96 | 96 | 5,760 |
    /// | after #1588, this checkout | 57 | 57 | 3,420 |
    /// | the first after #1620, filling the ETag ledger | 57 | 57 | — |
    /// | every settled one after that | 57 | 0 | 0 |
    ///
    /// The last row is measured against the host, not derived: each of the 57 goes out carrying the
    /// `ETag` it was last answered with, all 57 come back `304 Not Modified`, and GitHub's
    /// `x-ratelimit-used` does not move — a 304 does not count against the primary limit (#1620).
    /// The requests are still made; what they cost is nothing.
    ///
    /// The floor is what cannot be validated: a branch holding an OPEN pull request is asked
    /// outright, because a check run finishing does not touch the pull request it ran on, so the
    /// listing that carries it would answer `304` while CI moved. One open pull request therefore
    /// costs 3 a tick — the listing and its two sub-reads — or 180 an hour.
    ///
    /// The Tickets poll spends a measured 30 a tick on the same grant. With one pull request open
    /// the pair now cost 1,980 against the host's 5,000, where they cost 4,800 before; with none,
    /// 1,800. The lever left is a listing that covers more than what is open, out of scope here.
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
