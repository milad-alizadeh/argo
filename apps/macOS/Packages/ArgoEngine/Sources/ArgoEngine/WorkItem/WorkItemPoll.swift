import Foundation

/// Which Binding a poll reads through, and which Project it answers for.
///
/// The Project id travels with the Binding because health is keyed on both (#260): the same
/// Account bound by two Projects is two connections, and one of them can be failing.
public struct WorkItemPollTarget: Sendable {
    public let binding: ResolvedBinding
    public let projectID: String

    public init(binding: ResolvedBinding, projectID: String) {
        self.binding = binding
        self.projectID = projectID
    }

    /// The three facts a read and a health record need, named here so the poll asks the target
    /// rather than walking `binding.binding` at every site.
    var scope: String {
        binding.binding.scope
    }

    var accountID: String {
        binding.binding.accountID
    }

    var projectBinding: ProjectBinding {
        binding.binding
    }
}

/// The repeating read of one Project's Work Items — a desktop app receives no webhooks, so polling
/// is the only way the room is ever right (`CONTEXT.md` → Ports).
///
/// An actor, so no read and no decode ever runs on the MainActor, and the whole loop is one
/// `Task` that `stop()` cancels: a Project closed mid-request leaves nothing running behind it.
public actor WorkItemPoll {
    public typealias Sleeper = @Sendable (Duration) async throws -> Void

    private let port: WorkItemPort
    private let health: ConnectionHealthLedger
    private let items: WorkItemLedger
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
        port: WorkItemPort,
        health: ConnectionHealthLedger,
        items: WorkItemLedger,
        sleep: @escaping Sleeper = { try await Task.sleep(for: $0) },
        now: @escaping @Sendable () -> Date = Date.init,
    ) {
        self.port = port
        self.health = health
        self.items = items
        self.sleep = sleep
        self.now = now
    }

    /// Tell the poll who to raise on. Separate from `init` because the reader is a surface the loop
    /// is built long before, and replacing it costs nothing: `point` is the only thing that starts
    /// a loop, and every caller of it reports here first.
    public func report(to landed: @escaping Landing) {
        self.landed = landed
    }

    /// Read now, then every `interval` until stopped. Starting again replaces the loop rather than
    /// adding one, so a Project rebound mid-run polls through its new Binding and not both.
    public func start(_ target: WorkItemPollTarget, every interval: Duration) {
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

    /// Point at whatever a Project reads Work Items through, or stop.
    ///
    /// The decision and not the caller's, so the one surface that owns a Binding cannot disagree
    /// with the poll about what an unbound port means. Both `unbound` and `broken` stop rather than
    /// fail: a Project with no Work Item provider is a fully-onboarded state (`CONTEXT.md` L1 ·
    /// Binding), and a Binding that has come undone is the Connect panel's to repair rather than a
    /// read to keep retrying into the health chip.
    ///
    /// Stopping leaves the LISTING where it is — the same rule that keeps a failed tick from
    /// blanking a room keeps a rebind from blanking it either.
    /// Re-pointing at what it is already reading does nothing, so a surface may call this on every
    /// rebuild: `start` reads immediately, and a panel that rebuilds on each keystroke would
    /// otherwise spend a request per act.
    public func point(_ resolution: BindingResolution, at projectID: String?) async {
        guard let projectID, case let .ready(binding) = resolution else {
            pointedAt = nil
            return stop()
        }
        let target = Pointing(binding: binding, projectID: projectID)
        guard target != pointedAt else { return }
        pointedAt = target
        start(
            WorkItemPollTarget(binding: binding, projectID: projectID),
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

    /// One read. Public because a Work room's Refresh is the same act as a tick, and two paths to
    /// it would be two chances to record health differently.
    public func poll(_ target: WorkItemPollTarget) async {
        do {
            let listed = try await port.list(in: target.scope, grant: target.binding.grant)
            await items.record(listed, for: target.projectID)
            await health.succeeded(target.projectBinding, in: target.projectID, at: now())
        } catch {
            await record(error as? WorkItemFetchError ?? .unreachable, of: target)
        }
        // On the failing path too: the listing did not move, but the health behind the provider's
        // own dot did, and that is drawn from the same read.
        await landed()
    }

    /// The listing is deliberately untouched on every path through here — a failed read leaves
    /// what was fetched where it was, old and still accurately DERIVED.
    private func record(_ error: WorkItemFetchError, of target: WorkItemPollTarget) async {
        guard let cause = error.cause else {
            await health.grantRefused(target.accountID)
            return
        }
        await health.failed(target.projectBinding, in: target.projectID, cause: cause)
    }

    /// `false` once the wait was cancelled, which is the loop's only exit besides `stop()`.
    private func sleptWithoutCancelling(_ interval: Duration) async -> Bool {
        await (try? sleep(interval)) != nil
    }
}
