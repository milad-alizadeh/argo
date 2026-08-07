@testable import ArgoEngine
import Foundation

func hubFixtureObservation(_ fixture: String) async throws -> TranscriptObservation {
    try await hubTestObservation(id: fixture, events: Fixture.events(fixture))
}

func hubTestObservation(
    id: String,
    events: [TranscriptEvent],
)
    -> TranscriptObservation {
    let stream = AsyncStream<TranscriptEvent> { continuation in
        for event in events {
            continuation.yield(event)
        }
        continuation.finish()
    }
    return TranscriptObservation(
        id: id,
        sourceURL: URL(fileURLWithPath: "/tmp/\(id).jsonl"),
        events: stream,
    )
}
