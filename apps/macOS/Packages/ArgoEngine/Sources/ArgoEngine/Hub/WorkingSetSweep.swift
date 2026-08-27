import Foundation

/// Which transcripts belong to the Project right now. Discovery moves the working set while the app
/// runs, and this is the half that finds it: a poller that hands its answer on, where what happens
/// to the tails is the watch's to decide.
///
/// The Project is captured at `begin` rather than re-read on every sweep — the Hub's Project
/// follows the checkout, and a sweep is for the Project it was begun for until it is ended.
@MainActor
final class WorkingSetSweep {
    private let discovery: SessionDiscovery
    /// Absent while nothing is being swept for, which is also the flag `refresh` re-reads after its
    /// await.
    private var projectURL: URL?
    private var sweeping: Task<Void, Never>?
    private var hand: (@MainActor ([URL]) async -> Void)?

    init(discovery: SessionDiscovery) {
        self.discovery = discovery
    }

    /// Sweep once, then keep sweeping as the record directory changes — which is what makes a
    /// Session started after launch appear without a relaunch.
    ///
    /// Any sweep already running is ended first. `connect` suspends twice before reaching here, so
    /// two of them can interleave; overwriting the task rather than ending it would leave the first
    /// loop sweeping for the process's lifetime, against a Project nobody is looking at.
    func begin(
        in projectURL: URL,
        handingTo hand: @escaping @MainActor ([URL]) async -> Void,
    ) async {
        await stop()
        self.projectURL = projectURL
        self.hand = hand
        await refresh()
        sweeping = Task { [weak self] in
            guard let changes = self?.discovery.changes() else { return }
            for await _ in changes {
                await self?.refresh()
            }
        }
    }

    /// Re-run the sweep and hand its answer on, newest transcript first.
    ///
    /// Re-read after the await: the sweep runs off the main actor, and a `stop` in the meantime
    /// means this answer is about a Project nobody is pointed at any more.
    func refresh() async {
        guard let projectURL, let hand else { return }
        let wanted = await discovery.workingSet(for: projectURL)
        guard self.projectURL != nil else { return }
        await hand(wanted)
    }

    /// End the sweep before the tails it feeds are torn down, and await it: a sweep still running
    /// would otherwise re-register a transcript of the Project being dropped.
    func stop() async {
        projectURL = nil
        sweeping?.cancel()
        await sweeping?.value
        sweeping = nil
        hand = nil
    }
}
