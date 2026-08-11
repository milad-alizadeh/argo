import Foundation

/// One entry in the per-machine Project registry.
///
/// The id is stable and the path a mutable attribute (CONTEXT.md L1), so a folder that moves
/// re-points the Project it already was rather than becoming a second one, and every link keyed on
/// the id survives the move.
public struct ProjectRecord: Equatable, Sendable, Identifiable {
    public let id: String
    public let path: String
    /// At most one Binding per port, collapsed here rather than checked by callers so it also holds
    /// for a hand-edited file. The first entry for a port wins.
    public let bindings: [ProjectBinding]

    public init(id: String, path: String, bindings: [ProjectBinding] = []) {
        self.id = id
        self.path = path
        var seen: Set<AccountPort> = []
        self.bindings = bindings.filter { seen.insert($0.port).inserted }
    }

    public func binding(on port: AccountPort) -> ProjectBinding? {
        bindings.first { $0.port == port }
    }

    /// The same Project at a new path. Everything keyed on the id, Bindings included, comes with
    /// it.
    func relocated(to path: String) -> ProjectRecord {
        ProjectRecord(id: id, path: path, bindings: bindings)
    }

    /// Bind a port, replacing whatever filled it. Only that port moves: one GitHub Account normally
    /// fills both, and nothing in the model says the two have to name the same one.
    func replacingBinding(_ binding: ProjectBinding) -> ProjectRecord {
        ProjectRecord(
            id: id,
            path: path,
            bindings: [binding] + bindings.filter { $0.port != binding.port },
        )
    }

    func removingBinding(port: AccountPort) -> ProjectRecord {
        ProjectRecord(id: id, path: path, bindings: bindings.filter { $0.port != port })
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
