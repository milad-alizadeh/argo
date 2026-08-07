import Foundation

public struct HubProject: Equatable, Sendable {
    public let name: String
    public let url: URL

    public init(url: URL) {
        self.url = url
        self.name = url.lastPathComponent.isEmpty ? "Argo" : url.lastPathComponent
    }
}
