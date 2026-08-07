import Foundation

/// One physical transcript and the typed event stream read from it.
public struct TranscriptObservation: Sendable {
    public let id: String
    public let sourceURL: URL
    public let events: AsyncStream<TranscriptEvent>

    public init(id: String, sourceURL: URL, events: AsyncStream<TranscriptEvent>) {
        self.id = id
        self.sourceURL = sourceURL
        self.events = events
    }
}
