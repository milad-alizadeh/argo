import Foundation

public enum TranscriptObservationError: Error, Equatable, Sendable {
    case unreadable(URL)
}
