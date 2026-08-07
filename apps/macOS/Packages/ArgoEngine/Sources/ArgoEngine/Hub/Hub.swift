import Foundation
import Observation

/// The process-lifetime, rebuildable join consumed by the app's views.
///
/// The tails are owned here rather than by the caller, because both things that move the working
/// set — discovery adding and dropping one transcript, and a Project switch dropping all of them —
/// have to stop a tail without ending the process.
@MainActor
@Observable
public final class Hub {
    public private(set) var project: HubProject
    public private(set) var checkout = CheckoutProjection.Head.unavailable
    public private(set) var connection = HubConnection.healthy
    public var sessions: [HubSession] {
        join.sessions
    }

    private var join = HubJoin()
    @ObservationIgnored private var observations: [String: Task<Void, Never>] = [:]
    @ObservationIgnored let discovery: SessionDiscovery
    /// What the sweep is running against, absent while the Hub is disconnected or reading a named
    /// transcript. Holding the engine here is what lets a later sweep open a file `connect` never
    /// saw.
    @ObservationIgnored var sweep: HubSweep?
    @ObservationIgnored var sweeping: Task<Void, Never>?

    /// The observations registered right now. Asserted on by the test that re-points repeatedly: a
    /// leaked tail is invisible in the roster it no longer feeds.
    var liveObservationCount: Int {
        observations.count
    }

    var observedTranscriptIDs: [String] {
        Array(observations.keys)
    }

    func isObserving(transcriptID: String) -> Bool {
        observations[transcriptID] != nil
    }

    public init(projectURL: URL, discovery: SessionDiscovery = SessionDiscovery()) {
        self.project = HubProject(url: projectURL)
        self.discovery = discovery
    }

    /// Point the Hub at a Project. Everything the previous one established is cancelled and
    /// dropped first, so no tail of it survives and no event of it reaches the rebuilt roster.
    ///
    /// With no transcript named, the Sessions are the ones discovery finds on disk and the working
    /// set keeps moving while the app runs. A named transcript is the render harness's explicit
    /// override: the caller has said what to read, so nothing is swept for.
    ///
    /// Returns once the tails have started, not once they end — a live transcript has no end, so a
    /// `connect` that awaited them would never return.
    public func connect(using engine: Engine, configuration: LaunchConfiguration) async {
        await disconnect()
        project = HubProject(url: configuration.projectURL)
        connection = configuration.transcriptURLs.isEmpty ? .healthy : .reconnecting
        await refreshCheckout(using: engine, at: configuration.projectURL)
        guard !configuration.transcriptURLs.isEmpty else {
            // The sweep runs against the RESOLVED Project, which `refreshCheckout` has just read:
            // launched inside a subdirectory of a repo, the Project is the repo, and scoping to the
            // launch path would hide every Session working anywhere else in it.
            await beginDiscovery(for: project.url, using: engine)
            return
        }
        await observeNamed(configuration.transcriptURLs, using: engine)
    }

    /// Drop the whole Project: the sweep, every tail, the join they fed, and the checkout and
    /// connection state read alongside them. The checkout goes too, rather than being left to be
    /// overwritten — a branch belonging to the repo we are no longer pointed at is a fact we do not
    /// have.
    public func disconnect() async {
        await stopSweeping()
        await stopObservingAll()
        checkout = .unavailable
        connection = .healthy
    }

    /// The whole named set is validated before any tail starts, and one unreadable name fails the
    /// connection: the caller asked for those files, so a missing one is its answer rather than a
    /// smaller roster. Discovery's own opens are skipped instead — see `refreshWorkingSet`.
    private func observeNamed(_ urls: [URL], using engine: Engine) async {
        do {
            for observation in try engine.observeTranscripts(at: urls) {
                await startObserving(observation)
            }
            connection = .healthy
        } catch {
            await stopObservingAll()
            connection = .failed(message: "Transcript unavailable")
        }
    }

    /// Start tailing one transcript, as a Session the roster has not seen before. It joins the
    /// working set immediately, and stopping it later leaves every other tail running.
    public func startObserving(_ observation: TranscriptObservation) async {
        await stopObserving(transcriptID: observation.id)
        await startTailing(observation)
    }

    /// Start tailing one transcript, keeping whatever row the roster already holds for it.
    ///
    /// What discovery calls, and the distinction is not cosmetic: the join resolves a record's
    /// owner by which transcript claimed it FIRST, so re-adding a paused resume-chain root would
    /// put it behind its own continuation and re-attribute the records it authored. A tail re-reads
    /// from the start of the file, so the row it rejoins is rebuilt rather than left stale.
    func startTailing(_ observation: TranscriptObservation) async {
        await pauseObserving(transcriptID: observation.id)
        join.add(observation)
        observations[observation.id] = Task { [weak self] in await self?.drain(observation) }
    }

    /// Stop one tail and drop its transcript from the join, leaving the rest tailing.
    public func stopObserving(transcriptID: String) async {
        join.remove(transcriptID: transcriptID)
        await pauseObserving(transcriptID: transcriptID)
    }

    /// Stop one tail, keeping in the roster the Session it read. What discovery calls when a
    /// transcript ages out of the working set: the descriptors are the bounded resource, and a row
    /// vanishing under the user would be a claim that the Session never happened.
    ///
    /// Awaits the cancelled task, so a stopped tail is provably over before this returns. That is
    /// what keeps a straggling event from landing under an id re-registered in the meantime — the
    /// dead tail cannot still be running when the live one takes the id.
    public func pauseObserving(transcriptID: String) async {
        guard let task = observations.removeValue(forKey: transcriptID) else { return }
        task.cancel()
        await task.value
    }

    public func refreshCheckout(using engine: Engine, at projectURL: URL) async {
        let projection = await engine.checkout(at: projectURL)
        project = HubProject(url: projection.repositoryURL)
        checkout = projection.head
    }

    func waitForObservation(transcriptID: String) async {
        await observations[transcriptID]?.value
    }

    /// The join is emptied before anything is cancelled, so a tail that gets one more turn while
    /// tearing down finds no transcript to apply against. Cancelling the whole set before awaiting
    /// any of it keeps a slow teardown from serialising behind the one in front of it.
    private func stopObservingAll() async {
        let stopped = Array(observations.values)
        observations = [:]
        join = HubJoin()
        for task in stopped {
            task.cancel()
        }
        for task in stopped {
            await task.value
        }
    }

    private func drain(_ observation: TranscriptObservation) async {
        for await event in observation.events {
            join.apply(event, to: observation.id)
        }
    }
}
