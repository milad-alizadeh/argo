import Foundation

/// The repeating read every port is kept right by, and the floor under every room's freshness
/// (`CONTEXT.md` → Ports).
///
/// Not the only way a room is current any more: GitHub's webhook forwarder needs no endpoint of
/// Argo's, so the code host is pushed as well as polled (`DeliverySocket`, ADR-0018 / #1579). This
/// keeps its own interval regardless — the socket belongs to a CLI preview GitHub can withdraw, and
/// it is what covers the user it will not open for.
///
/// Held apart from what a tick READS because the Tickets poll and the Delivery derivation pace
/// identically and differ only in the one call inside: two copies of this would be two chances to
/// leave a `Task` running behind a Project that closed.
///
/// An actor, so nothing here runs on the MainActor, and the whole loop is one `Task` that `stop()`
/// cancels.
public actor PortPollLoop {
    public typealias Sleeper = @Sendable (Duration) async throws -> Void
    /// One read. The loop never sees what it answered: recording an outcome is the caller's, and a
    /// failure is not the loop's to retry — the next tick is the retry.
    public typealias Tick = @Sendable (PortReadTarget) async -> Void

    private let sleep: Sleeper
    private let tick: Tick
    private var loop: Task<Void, Never>?
    private var pointedAt: PortPointing?

    public init(
        sleep: @escaping Sleeper = { try await Task.sleep(for: $0) },
        tick: @escaping Tick,
    ) {
        self.sleep = sleep
        self.tick = tick
    }

    /// Read now, then every `interval` until stopped. Starting again replaces the loop rather than
    /// adding one, so a Project rebound mid-run reads through its new Binding and not both.
    ///
    /// It forgets what `point` last pointed at, because a caller that starts a target directly has
    /// moved what the loop reads without going through the comparison — and a `pointedAt` left
    /// behind would then match a `point` at the OLD Binding and refuse to restart, leaving the loop
    /// reading a scope nobody asked for.
    public func start(_ target: PortReadTarget, every interval: Duration) {
        pointedAt = nil
        loop?.cancel()
        loop = Task { [weak self] in
            while !Task.isCancelled {
                guard let self else { return }
                await tick(target)
                guard await PortSleep.uncancelled(sleep, for: interval) else { return }
            }
        }
    }

    public func stop() {
        loop?.cancel()
        loop = nil
        pointedAt = nil
    }

    /// Point at whatever a Project reads through, or stop.
    ///
    /// The loop's decision and not its caller's, so the one surface that owns a Binding cannot
    /// disagree with it about what an unbound port means. Both `unbound` and `broken` stop rather
    /// than fail: a Project with no provider is a fully-onboarded state (`CONTEXT.md` L1 ·
    /// Binding), and a Binding that has come undone is the Connect panel's to repair rather than a
    /// read to keep retrying into the health chip.
    ///
    /// Stopping leaves whatever the last read landed where it is — the same rule that keeps a
    /// failed tick from blanking a room keeps a rebind from blanking it either.
    ///
    /// Re-pointing at what it is already reading does nothing, so a surface may call this on every
    /// rebuild: `start` reads immediately, and a panel that rebuilds on each keystroke would
    /// otherwise spend a request per act.
    public func point(
        _ resolution: BindingResolution,
        at projectID: String?,
        every interval: Duration,
    ) {
        guard let projectID, case let .ready(binding) = resolution else { return stop() }
        let target = PortPointing(binding: binding, projectID: projectID)
        guard target != pointedAt else { return }
        // Recorded AFTER the start, which forgets whatever it was pointed at before.
        start(PortReadTarget(binding: binding, projectID: projectID), every: interval)
        pointedAt = target
    }
}
