import Foundation

/// The fast path onto one Project's Deliveries: GitHub pushes a pull request down a socket in under
/// a second, where the poll would take up to a minute to ask (#1579).
///
/// Additive, and never load-bearing. `DeliveryPoll` keeps its own interval whatever this does, and
/// covers every case this one cannot: a grant the host will not open a hook on, a repository the
/// user does not administer, a socket that dropped, a forwarder GitHub has withdrawn, and every
/// delivery that arrived while the socket was down. So nothing here reports a failure — a watch
/// that will not open is a Project reading at the poll's pace, which is what it did before.
///
/// An actor for `PortPollLoop`'s reason: no dial and no decode runs on the MainActor, and the whole
/// run is one `Task` that `stop()` cancels.
public actor DeliverySocket {
    /// One derivation, which is `DeliveryPoll.derive` — the same act a tick performs, so a fact
    /// that arrived over the socket is recorded exactly as a polled one is.
    public typealias Derive = @Sendable (PortReadTarget) async -> Void
    public typealias Sleeper = PortPollLoop.Sleeper

    private let watch: any CodeHostWatch
    private let derive: Derive
    private let sleep: Sleeper
    private var run: Task<Void, Never>?
    private var pointedAt: PortPointing?

    public init(
        watch: any CodeHostWatch,
        derive: @escaping Derive,
        sleep: @escaping Sleeper = { try await Task.sleep(for: $0) },
    ) {
        self.watch = watch
        self.derive = derive
        self.sleep = sleep
    }

    /// Point at whatever a Project reads its code host through, or stop. `PortPollLoop.point`'s
    /// resolutions mean the same here, and re-pointing at an unchanged Binding does nothing.
    public func point(_ resolution: BindingResolution, at projectID: String?) {
        guard let projectID, case let .ready(binding) = resolution else { return stop() }
        let pointing = PortPointing(binding: binding, projectID: projectID)
        guard pointing != pointedAt else { return }
        start(PortReadTarget(binding: binding, projectID: projectID))
        pointedAt = pointing
    }

    public func stop() {
        run?.cancel()
        run = nil
        pointedAt = nil
    }

    private func start(_ target: PortReadTarget) {
        pointedAt = nil
        run?.cancel()
        run = Task { [weak self] in
            var refusals = 0
            while !Task.isCancelled {
                guard let self else { return }
                refusals = await watched(target) ? 0 : refusals + 1
                guard !Task.isCancelled else { return }
                guard await sleptWithoutCancelling(Self.backoff(after: refusals)) else { return }
            }
        }
    }

    /// One socket, from the dial to the end of it. `true` where it opened at all, which is the only
    /// thing that separates a host declining to push from a socket that pushed and then dropped.
    private func watched(_ target: PortReadTarget) async -> Bool {
        guard let opened = try? await watch.open(target.scope, grant: target.binding.grant)
        else { return false }
        // Derived BEFORE the first wait, on every connection and not just the first: a socket that
        // was down missed deliveries and the host never repeats them. Frames that land during this
        // derivation are queued by the channel rather than lost.
        await derive(target)
        while !Task.isCancelled {
            guard await (try? opened.nextMove()) != nil else { break }
            await derive(target)
        }
        await opened.close()
        return true
    }

    /// The wait before dialling again, doubling from a second up to the poll's own interval.
    ///
    /// Capped there because a socket that never opens costs exactly nothing over the poll that is
    /// already running — so the last thing this should do is keep asking faster than the read it is
    /// trying to beat. A socket that carried resets the count, so an ordinary drop reconnects in a
    /// second.
    private static func backoff(after refusals: Int) -> Duration {
        .seconds(min(DeliveryPoll.interval.components.seconds, Int64(1) << min(refusals, 6)))
    }

    /// `false` once the wait was cancelled, which is the run's only exit besides `stop()`.
    private func sleptWithoutCancelling(_ interval: Duration) async -> Bool {
        await (try? sleep(interval)) != nil
    }
}
