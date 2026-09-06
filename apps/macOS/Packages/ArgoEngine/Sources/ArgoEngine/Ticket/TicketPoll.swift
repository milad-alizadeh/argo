import Foundation

/// The repeating read of one Project's Tickets — a desktop app receives no webhooks, so polling
/// is the only way the room is ever right (`CONTEXT.md` → Ports).
///
/// An actor, so no read and no decode ever runs on the MainActor. The loop itself is
/// `PortPollLoop`'s, which every port's repeating read is paced by.
public actor TicketPoll {
    public typealias Sleeper = PortPollLoop.Sleeper

    private let port: TicketReading
    private let health: ConnectionHealthLedger
    private let items: TicketLedger
    private let now: @Sendable () -> Date
    private var landed: Landing = {}
    /// Built lazily because its tick reads this actor, which does not exist while `init` runs.
    private lazy var loop = PortPollLoop(sleep: sleep) { [weak self] target in
        await self?.poll(target)
    }

    private let sleep: Sleeper

    /// Raised once a read has finished. A tick is the only thing that moves the listing, and
    /// nothing above an actor can observe one — a room wired to the ledger alone would draw the
    /// backlog as it was when the reader last clicked something.
    public typealias Landing = @Sendable () async -> Void

    /// The two ledgers one read writes into: how the connection fared, and the Tickets it landed.
    public struct Ledgers: Sendable {
        public let health: ConnectionHealthLedger
        public let items: TicketLedger

        public init(health: ConnectionHealthLedger, items: TicketLedger) {
            self.health = health
            self.items = items
        }
    }

    /// Where the loop gets time from: how it waits between reads, and how it reads the moment.
    public struct Pacing: Sendable {
        public let sleep: Sleeper
        public let now: @Sendable () -> Date

        public init(
            sleep: @escaping Sleeper = { try await Task.sleep(for: $0) },
            now: @escaping @Sendable () -> Date = Date.init,
        ) {
            self.sleep = sleep
            self.now = now
        }
    }

    public init(port: TicketReading, ledgers: Ledgers, pacing: Pacing = Pacing()) {
        self.port = port
        self.health = ledgers.health
        self.items = ledgers.items
        self.sleep = pacing.sleep
        self.now = pacing.now
    }

    /// Tell the poll who to raise on. Called before the first `point`, which is the only thing that
    /// starts a loop.
    public func report(to landed: @escaping Landing) {
        self.landed = landed
    }

    public func start(_ target: PortReadTarget, every interval: Duration) async {
        await loop.start(target, every: interval)
    }

    public func stop() async {
        await loop.stop()
    }

    /// A minute. A desktop app receives no webhooks, so a room is only ever as right as its last
    /// tick — and the provider's hourly budget is what stops the number being smaller.
    public static let interval = Duration.seconds(60)

    /// Point at whatever a Project reads Tickets through, or stop. What each resolution means is
    /// `PortPollLoop.point`'s.
    ///
    /// It raises the landing on every path, the two that change nothing included: a rebind moves
    /// which listing the reader should be holding without a tick having happened.
    public func point(_ resolution: BindingResolution, at projectID: String?) async {
        await loop.point(resolution, at: projectID, every: Self.interval)
        await landed()
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
}
