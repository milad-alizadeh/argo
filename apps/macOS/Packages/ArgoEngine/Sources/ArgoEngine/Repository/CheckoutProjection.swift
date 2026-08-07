import Foundation

/// The global primary checkout rendered by the shell, distinct from every Session workspace.
public struct CheckoutProjection: Equatable, Sendable {
    public enum Head: Equatable, Sendable {
        case branch(String)
        case detached(shortSHA: String)
        case unavailable
    }

    public let repositoryURL: URL
    public let head: Head

    public init(repositoryURL: URL, head: Head) {
        self.repositoryURL = repositoryURL
        self.head = head
    }
}
