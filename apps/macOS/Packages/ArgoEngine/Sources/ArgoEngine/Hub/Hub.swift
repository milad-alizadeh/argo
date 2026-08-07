import Foundation
import Observation

/// The process-lifetime, rebuildable join consumed by the app's views.
@MainActor
@Observable
public final class Hub {
    private struct RecordOwner {
        let transcriptIndex: Int
        let transcriptID: String
    }

    public private(set) var project: HubProject
    public private(set) var sessions: [HubSession] = []
    public private(set) var checkout = CheckoutProjection.Head.unavailable
    public private(set) var connection = HubConnection.healthy
    private var transcripts: [HubTranscript] = []
    private var recordOwners: [String: RecordOwner] = [:]

    public init(projectURL: URL) {
        project = HubProject(url: projectURL)
    }

    public func connect(using engine: Engine, configuration: LaunchConfiguration) async {
        connection = configuration.transcriptURLs.isEmpty ? .healthy : .reconnecting
        await refreshCheckout(using: engine, at: configuration.projectURL)
        guard !configuration.transcriptURLs.isEmpty else { return }
        do {
            let observations = try engine.observeTranscripts(at: configuration.transcriptURLs)
            transcripts = observations.map(HubTranscript.init)
            recordOwners = [:]
            rebuildSessions()
            connection = .healthy
            await consume(observations)
        } catch {
            transcripts = []
            recordOwners = [:]
            sessions = []
            connection = .failed(message: "Transcript unavailable")
        }
    }

    public func observe(_ observation: TranscriptObservation) async {
        if !transcripts.contains(where: { $0.id == observation.id }) {
            transcripts.append(HubTranscript(observation: observation))
            rebuildSessions()
        }
        for await event in observation.events {
            guard !Task.isCancelled else { return }
            apply(event, to: observation.id)
        }
    }

    public func refreshCheckout(using engine: Engine, at projectURL: URL) async {
        let projection = await engine.checkout(at: projectURL)
        project = HubProject(url: projection.repositoryURL)
        checkout = projection.head
    }

    private func consume(_ observations: [TranscriptObservation]) async {
        await withTaskGroup(of: Void.self) { group in
            for observation in observations {
                group.addTask { await self.observe(observation) }
            }
            await group.waitForAll()
        }
    }

    private func apply(_ event: TranscriptEvent, to sessionID: String) {
        guard let index = transcripts.firstIndex(where: { $0.id == sessionID }) else { return }
        transcripts[index].session.apply(event)
        if case let .recordIdentity(uuid) = event {
            rememberOwner(of: uuid, transcriptID: sessionID, transcriptIndex: index)
        }
        rebuildSessions()
    }

    private func rememberOwner(of uuid: String, transcriptID: String, transcriptIndex: Int) {
        if let existing = recordOwners[uuid], existing.transcriptIndex <= transcriptIndex { return }
        recordOwners[uuid] = RecordOwner(
            transcriptIndex: transcriptIndex,
            transcriptID: transcriptID,
        )
    }

    private func rebuildSessions() {
        let owners = recordOwners.mapValues(\.transcriptID)
        sessions = HubSessionChain.sessions(from: transcripts, owners: owners)
    }
}
