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

    /// The observations registered right now. Asserted on by the test that re-points repeatedly: a
    /// leaked tail is invisible in the roster it no longer feeds.
    var liveObservationCount: Int {
        observations.count
    }

    public init(projectURL: URL) {
        self.project = HubProject(url: projectURL)
    }

    /// Point the Hub at a Project. Everything the previous one established is cancelled and
    /// dropped first, so no tail of it survives and no event of it reaches the rebuilt roster.
    ///
    /// Returns once the tails have started, not once they end — a live transcript has no end, so a
    /// `connect` that awaited them would never return.
    public func connect(using engine: Engine, configuration: LaunchConfiguration) async {
        await disconnect()
        project = HubProject(url: configuration.projectURL)
        connection = configuration.transcriptURLs.isEmpty ? .healthy : .reconnecting
        await refreshCheckout(using: engine, at: configuration.projectURL)
        guard !configuration.transcriptURLs.isEmpty else { return }
        do {
            for observation in try engine.observeTranscripts(at: configuration.transcriptURLs) {
                await startObserving(observation)
            }
            connection = .healthy
        } catch {
            await stopObservingAll()
            connection = .failed(message: "Transcript unavailable")
        }
    }

    /// Drop the whole Project: every tail, the join it fed, and the checkout and connection state
    /// read alongside it. The checkout goes too, rather than being left to be overwritten — a
    /// branch belonging to the repo we are no longer pointed at is a fact we do not have.
    public func disconnect() async {
        await stopObservingAll()
        checkout = .unavailable
        connection = .healthy
    }

    /// Start tailing one transcript. It joins the working set immediately, and stopping it later
    /// leaves every other tail running.
    public func startObserving(_ observation: TranscriptObservation) async {
        await stopObserving(transcriptID: observation.id)
        join.add(observation)
        observations[observation.id] = Task { [weak self] in await self?.drain(observation) }
    }

    /// Stop one tail and drop its transcript from the join, leaving the rest tailing.
    ///
    /// Awaits the cancelled task, so a stopped tail is provably over before this returns. That is
    /// what keeps a straggling event from landing under an id re-registered in the meantime — the
    /// dead tail cannot still be running when the live one takes the id.
    public func stopObserving(transcriptID: String) async {
        guard let task = observations.removeValue(forKey: transcriptID) else { return }
        join.remove(transcriptID: transcriptID)
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
