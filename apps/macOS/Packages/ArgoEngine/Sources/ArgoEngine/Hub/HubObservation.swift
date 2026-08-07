import Foundation

/// One transcript in the Hub's working set, and whether anything is still reading it.
///
/// The Hub's projection of a `TranscriptObservation`, not the port itself: the port carries a
/// stream nobody outside the Hub may consume, and this carries only what a caller can be told
/// about it.
public struct HubObservation: Equatable, Identifiable, Sendable {
    public enum State: Equatable, Sendable {
        /// A tail is running — events from this transcript are still reaching the roster.
        case live

        /// The row is kept, but nothing is reading it: the transcript aged out of the working set,
        /// or its record ended. The descriptors are the bounded resource, not the roster.
        case stopped
    }

    public let id: String
    public let sourceURL: URL
    public let state: State

    public init(id: String, sourceURL: URL, state: State) {
        self.id = id
        self.sourceURL = sourceURL
        self.state = state
    }
}
