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
    /// One live tail.
    ///
    /// The token, rather than the task's own cancellation, is what gates an event, so that "this
    /// tail is over" is a fact about the registry and not about how promptly a cancelled
    /// `for await` notices. It also separates two tails over the same transcript id: a stopped one
    /// and its restart are the same task identity to a cancellation check, and different tokens
    /// here.
    private struct Tail {
        let token: Int
        let task: Task<Void, Never>
    }

    public private(set) var project: HubProject
    public private(set) var checkout = CheckoutProjection.Head.unavailable
    public private(set) var connection = HubConnection.healthy
    public var sessions: [HubSession] {
        join.sessions
    }

    private var join = HubJoin()
    @ObservationIgnored private var tails: [String: Tail] = [:]
    @ObservationIgnored private var lastTailToken = 0

    /// The tails currently live. The test that re-points repeatedly asserts on this rather than on
    /// the roster: a leaked tail is invisible in a roster it no longer feeds.
    var liveTailCount: Int {
        tails.count
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
    /// read alongside it.
    public func disconnect() async {
        await stopObservingAll()
        checkout = .unavailable
        connection = .healthy
    }

    /// Start tailing one transcript. It joins the working set immediately, and stopping it later
    /// leaves every other tail running.
    public func startObserving(_ observation: TranscriptObservation) async {
        await stopObserving(transcriptID: observation.id)
        lastTailToken += 1
        let token = lastTailToken
        join.add(observation)
        tails[observation.id] = Tail(
            token: token,
            task: Task { [weak self] in await self?.drain(observation, token: token) },
        )
    }

    /// Stop one tail and drop its transcript from the join, leaving the rest tailing.
    ///
    /// Awaits the cancelled task, so when this returns the stream is torn down and the file it was
    /// holding open is closed — a caller re-pointing in a loop accumulates neither.
    public func stopObserving(transcriptID: String) async {
        guard let tail = tails.removeValue(forKey: transcriptID) else { return }
        join.remove(transcriptID: transcriptID)
        tail.task.cancel()
        await tail.task.value
    }

    public func refreshCheckout(using engine: Engine, at projectURL: URL) async {
        let projection = await engine.checkout(at: projectURL)
        project = HubProject(url: projection.repositoryURL)
        checkout = projection.head
    }

    /// Start tailing and wait for the stream to end. Only a finite stream ever ends, so this is a
    /// test's seam onto `startObserving`, not a shape the app uses.
    func observe(_ observation: TranscriptObservation) async {
        await startObserving(observation)
        await waitForObservation(transcriptID: observation.id)
    }

    func waitForObservation(transcriptID: String) async {
        await tails[transcriptID]?.task.value
    }

    /// Deregistered and emptied before anything is cancelled, so a tail that runs once more during
    /// the teardown finds neither its token nor its transcript and applies nothing.
    private func stopObservingAll() async {
        let stopped = tails.values.map(\.task)
        tails = [:]
        join = HubJoin()
        for task in stopped {
            task.cancel()
        }
        for task in stopped {
            await task.value
        }
    }

    private func drain(_ observation: TranscriptObservation, token: Int) async {
        for await event in observation.events {
            guard tails[observation.id]?.token == token else { return }
            join.apply(event, to: observation.id)
        }
    }
}
