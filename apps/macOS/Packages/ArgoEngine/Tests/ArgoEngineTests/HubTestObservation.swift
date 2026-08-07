@testable import ArgoEngine
import Foundation
import Testing

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

/// An observation whose stream stays open until the test closes it, which is the shape a live
/// transcript has: the finite helper above can only ever test a session that is already over.
func hubLiveObservation(
    id: String,
)
    -> (TranscriptObservation, AsyncStream<TranscriptEvent>.Continuation) {
    let (events, continuation) = AsyncStream<TranscriptEvent>.makeStream()
    let observation = TranscriptObservation(
        id: id,
        sourceURL: URL(fileURLWithPath: "/tmp/\(id).jsonl"),
        events: events,
    )
    return (observation, continuation)
}

/// A real transcript on disk, so the tail under test is the file-backed one rather than a stream
/// the test hands it.
func hubFixtureURL(_ name: String) throws -> URL {
    try #require(
        Bundle.module.url(forResource: name, withExtension: "jsonl", subdirectory: "Fixtures"),
    )
}
