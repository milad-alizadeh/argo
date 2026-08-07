import Foundation

/// One physical transcript and the typed event stream read from it.
public struct TranscriptObservation: Sendable {
    public let id: String
    public let sourceURL: URL
    /// When the file was last written, where the file system could say. The roster's ordering
    /// fallback, for a transcript whose records carry no time of their own.
    public let modifiedAt: Date?
    /// Batched, and the first batch is the backfill of what the file already held — see
    /// `transcriptLines`.
    public let events: AsyncStream<[TranscriptEvent]>

    public init(
        id: String,
        sourceURL: URL,
        modifiedAt: Date? = nil,
        events: AsyncStream<[TranscriptEvent]>,
    ) {
        self.id = id
        self.sourceURL = sourceURL
        self.modifiedAt = modifiedAt
        self.events = events
    }
}
