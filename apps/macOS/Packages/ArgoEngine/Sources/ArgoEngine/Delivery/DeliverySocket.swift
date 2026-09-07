import Foundation

/// The fast path onto one Project's Deliveries: GitHub pushes a pull request down a socket in under
/// a second, where the poll would take up to a minute to ask (#1579).
///
/// `DeliveryPoll` keeps its own interval whatever this does: every way a watch can fail degrades a
/// Project to reading at the poll's pace, which is what it did before. That degrade-down is silent
/// on purpose — the roster does not need to know why the fast path is out — but a dial that never
/// opens is reported through `reportDialFailure` all the same, so the failure is readable somewhere
/// even while nothing downstream of it changes (#1643).
///
/// An actor for `PortPollLoop`'s reason: no dial and no decode runs on the MainActor, and the whole
/// run is one `Task` that `stop()` cancels.
actor DeliverySocket {
    /// One derivation, which is `DeliveryPoll.derive` — the same act a tick performs, so a fact
    /// that arrived over the socket is recorded exactly as a polled one is.
    typealias Derive = @Sendable (PortReadTarget) async -> Void
    /// A dial that did not open, reported rather than merely swallowed — the reading #1643 asked
    /// for, kept apart from `Derive` because a dial failure has no `PortReadTarget` derivation to
    /// run: nothing was read, so nothing here decides what the roster shows.
    typealias ReportDialFailure = @Sendable (PortReadTarget, Error) async -> Void

    private let watch: any CodeHostWatch
    private let derive: Derive
    private let reportDialFailure: ReportDialFailure
    private let sleep: PortPollLoop.Sleeper
    private var run: Task<Void, Never>?
    private var pointedAt: PortPointing?

    init(
        watch: any CodeHostWatch,
        derive: @escaping Derive,
        reportDialFailure: @escaping ReportDialFailure = { _, _ in },
        sleep: @escaping PortPollLoop.Sleeper = { try await Task.sleep(for: $0) },
    ) {
        self.watch = watch
        self.derive = derive
        self.reportDialFailure = reportDialFailure
        self.sleep = sleep
    }

    /// Point at whatever a Project reads its code host through, or stop. `PortPollLoop.point`'s
    /// resolutions mean the same here, and re-pointing at an unchanged Binding does nothing.
    func point(_ resolution: BindingResolution, at projectID: String?) {
        guard let projectID, case let .ready(binding) = resolution else { return stop() }
        let pointing = PortPointing(binding: binding, projectID: projectID)
        guard pointing != pointedAt else { return }
        start(PortReadTarget(binding: binding, projectID: projectID))
        pointedAt = pointing
    }

    func stop() {
        run?.cancel()
        run = nil
        pointedAt = nil
    }

    private func start(_ target: PortReadTarget) {
        pointedAt = nil
        run?.cancel()
        run = Task { [weak self] in
            var fruitless = 0
            while !Task.isCancelled {
                guard let self else { return }
                fruitless = await watched(target) ? 0 : fruitless + 1
                guard !Task.isCancelled else { return }
                guard await PortSleep.uncancelled(sleep, for: Self.backoff(after: fruitless))
                else { return }
            }
        }
    }

    /// One socket, from the dial to the end of it. `true` once it carried a MOVE, which is the only
    /// evidence that dialling again is worth anything.
    ///
    /// Not "it opened": a forwarder that takes the dial and drops the socket at once — a withdrawn
    /// preview, a scope revoked mid-run — would then reconnect every second forever, and each turn
    /// costs a hook create plus a whole derivation. That is many times the request rate of the poll
    /// this is meant to spare (#1579).
    private func watched(_ target: PortReadTarget) async -> Bool {
        let opened: any DeliveryWatch
        do {
            opened = try await watch.open(target.scope, grant: target.binding.grant)
        } catch {
            await reportDialFailure(target, error)
            return false
        }
        // Derived BEFORE the first wait, on every connection and not just the first: a socket that
        // was down missed deliveries and the host never repeats them. Frames that land during this
        // derivation are queued by the channel rather than lost.
        await derive(target)
        var carried = false
        while !Task.isCancelled {
            guard await (try? opened.nextMove()) != nil else { break }
            carried = true
            await derive(target)
        }
        await opened.close()
        return carried
    }

    /// The wait before dialling again: a second after a socket that carried, then doubling from two
    /// for each one that did not, up to the poll's own interval.
    ///
    /// Capped there because a socket that carries nothing costs exactly nothing over the poll that
    /// is already running — so the last thing it should do is keep asking faster than the read it
    /// means to beat. A quiet repository walks up to that cap and stays there, which costs nothing
    /// either: its drops are hours apart, and the first move resets the count.
    private static func backoff(after fruitless: Int) -> Duration {
        .seconds(min(DeliveryPoll.interval.components.seconds, Int64(1) << min(fruitless, 6)))
    }
}
