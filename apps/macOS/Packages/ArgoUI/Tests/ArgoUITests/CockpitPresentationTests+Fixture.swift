import ArgoEngine
@testable import ArgoUI
import Foundation

extension CockpitPresentationTests {
    /// The Hub half of the projection, which is the half with a derivation in it. The Projects are
    /// the app's own state and are passed straight through.
    @MainActor
    func projection(
        of hub: Hub,
        projects: [CockpitPresentation.Project] = [],
        annotations: SessionAnnotations = .empty,
    )
        -> CockpitPresentation {
        CockpitPresentation(
            projects: projects,
            activeProjectID: projects.first?.id,
            hub: hub,
            readings: .init(annotations: annotations),
        )
    }

    /// Drive a finite stream into the Hub and yield until the roster has read all of it.
    ///
    /// Yielding rather than awaiting the tail: the tail is the Hub's own task and nothing public
    /// hands it back, so the observable end is the roster the events land in.
    @MainActor
    func observe(
        _ hub: Hub,
        id: String,
        events: [TranscriptEvent],
        until applied: (CockpitPresentation.Session) -> Bool,
    ) async {
        // One batch, which is how a tail hands over a file it has finished reading.
        let stream = AsyncStream<[TranscriptEvent]> { continuation in
            continuation.yield(events)
            continuation.finish()
        }
        await hub.startObserving(TranscriptObservation(
            id: id,
            sourceURL: URL(fileURLWithPath: "/tmp/\(id).jsonl"),
            events: stream,
        ))
        for _ in 0 ..< 200 {
            if let session = projection(of: hub).sessions.first, applied(session) {
                return
            }
            await Task.yield()
        }
    }
}
