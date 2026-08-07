import Foundation

/// One entry in the per-machine Project registry.
///
/// The id is stable and the path a mutable attribute (CONTEXT.md L1), so a folder that moves
/// re-points the Project it already was rather than becoming a second one, and every link keyed on
/// the id survives the move.
public struct ProjectRecord: Equatable, Sendable, Identifiable, Codable {
    public let id: String
    public let path: String

    public init(id: String, path: String) {
        self.id = id
        self.path = path
    }

    public var url: URL {
        URL(fileURLWithPath: path, isDirectory: true)
    }

    /// One spelling of a Project's name, so the registry and the Hub can never disagree about it.
    public var name: String {
        HubProject(url: url).name
    }

    /// DERIVED at read time, never stored: a registered folder that has moved or been deleted is
    /// still a Project. Saying so is what makes it re-pointable rather than silently dropped.
    public var isReachable: Bool {
        var isDirectory: ObjCBool = false
        let exists = FileManager.default.fileExists(atPath: path, isDirectory: &isDirectory)
        return exists && isDirectory.boolValue
    }
}
