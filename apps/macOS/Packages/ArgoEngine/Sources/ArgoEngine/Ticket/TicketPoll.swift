import Foundation

/// The repeating read of one Project's Tickets — a desktop app receives no webhooks, so polling
/// is the only way the room is ever right (`CONTEXT.md` → Ports).
///
/// An actor, so no read and no decode ever runs on the MainActor, and the whole loop is one
/// `Task` that `stop()` cancels: a Project closed mid-request leaves nothing running behind it.
public actor TicketPoll {
    public typealias Sleeper = @Sendable (Duration) async throws -> Void

    private let port: TicketReading
    private let health: ConnectionHealthLedger
    private let items: TicketLedger
    private let sleep: Sleeper
    private let now: @Sendable () -> Date
    private var landed: Landing = {}
    private var loop: Task<Void, Never>?
    private var pointedAt: Pointing?

    /// Raised once a read has finished. A tick is the only thing that moves the listing, and
    /// nothing above an actor can observe one — a room wired to the ledger alone would draw the
    /// backlog as it was when the reader last clicked something.
    public typealias Landing = @Sendable () async -> Void

    public init(
        port: TicketReading,
        health: ConnectionHealthLedger,
        items: TicketLedger,
        sleep: @escaping Sleeper = { try await Task.sleep(for: $0) },
        now: @escaping @Sendable () -> Date = Date.init,
    ) {
        self.port = port
        self.health = health
        self.items = items
        self.sleep = sleep
        self.now = now
    }

    /// Tell the poll who to raise on. Called before the first `point`, which is the only thing that
    /// starts a loop.
    public func report(to landed: @escaping Landing) {
        self.landed = landed
    }

    /// Read now, then every `interval` until stopped. Starting again replaces the loop rather than
    /// adding one, so a Project rebound mid-run polls through its new Binding and not both.
    public func start(_ target: PortReadTarget, every interval: Duration) {
        loop?.cancel()
        loop = Task { [weak self] in
            while !Task.isCancelled {
                guard let self else { return }
                await poll(target)
                guard await sleptWithoutCancelling(interval) else { return }
            }
        }
    }

    public func stop() {
        loop?.cancel()
        loop = nil
    }

    /// A minute. A desktop app receives no webhooks, so a room is only ever as right as its last
    /// tick — and the provider's hourly budget is what stops the number being smaller.
    public static let interval = Duration.seconds(60)

    /// Point at whatever a Project reads Tickets through, or stop.
    ///
    /// The decision and not the caller's, so the one surface that owns a Binding cannot disagree
    /// with the poll about what an unbound port means. Both `unbound` and `broken` stop rather than
    /// fail: a Project with no Ticket provider is a fully-onboarded state (`CONTEXT.md` L1 ·
    /// Binding), and a Binding that has come undone is the Connect panel's to repair rather than a
    /// read to keep retrying into the health chip.
    ///
    /// Stopping leaves the LISTING where it is — the same rule that keeps a failed tick from
    /// blanking a room keeps a rebind from blanking it either.
    /// Re-pointing at what it is already reading does nothing, so a surface may call this on every
    /// rebuild: `start` reads immediately, and a panel that rebuilds on each keystroke would
    /// otherwise spend a request per act.
    /// It raises the landing on every path, the two that change nothing included: a rebind moves
    /// which listing the reader should be holding without a tick having happened.
    public func point(_ resolution: BindingResolution, at projectID: String?) async {
        settle(resolution, at: projectID)
        await landed()
    }

    /// Where the loop is aimed, settled synchronously so `point` above can raise on every path
    /// through it without a `defer` that would outlive the call.
    private func settle(_ resolution: BindingResolution, at projectID: String?) {
        guard let projectID, case let .ready(binding) = resolution else {
            pointedAt = nil
            return stop()
        }
        let target = Pointing(binding: binding, projectID: projectID)
        guard target != pointedAt else { return }
        pointedAt = target
        start(
            PortReadTarget(binding: binding, projectID: projectID),
            every: Self.interval,
        )
    }

    /// What the loop is currently reading, by the parts of it that can be compared.
    private struct Pointing: Equatable {
        let binding: ProjectBinding
        let projectID: String
        /// The token, because re-authorizing an Account leaves the Binding identical and replaces
        /// the grant — and a loop that treated that as unchanged would poll for the rest of the
        /// launch on a token the provider has stopped taking.
        let accessToken: String

        init(binding: ResolvedBinding, projectID: String) {
            self.binding = binding.binding
            self.projectID = projectID
            self.accessToken = binding.grant.accessToken
        }
    }

    /// One read. Public because a Tickets room's Refresh is the same act as a tick, and two paths
    /// to it would be two chances to record health differently.
    public func poll(_ target: PortReadTarget) async {
        do {
            let listed = try await port.list(through: target.binding)
            await items.record(listed, for: target.projectID)
            await health.succeeded(target.projectBinding, in: target.projectID, at: now())
        } catch {
            await health.record(error as? ProviderFetchError ?? .unreachable, of: target)
        }
        // On the failing path too: the listing did not move, but the health behind the provider's
        // own dot did, and that is drawn from the same read.
        await landed()
    }

    /// `false` once the wait was cancelled, which is the loop's only exit besides `stop()`.
    private func sleptWithoutCancelling(_ interval: Duration) async -> Bool {
        await (try? sleep(interval)) != nil
    }
}
