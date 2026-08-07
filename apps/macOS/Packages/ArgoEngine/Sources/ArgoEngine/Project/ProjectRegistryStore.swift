import Foundation

/// The per-machine registry file, and the only thing that writes it.
///
/// Owned state, never committed: paths and registration are per machine, so this lives in
/// application support rather than in the repo. Every mutation reads, transitions and writes in one
/// hop on the actor, so two windows registering at once cannot lose one another's Project.
public actor ProjectRegistryStore {
    /// `userData` in the Electron shell's spelling.
    public static let defaultFileURL = URL.applicationSupportDirectory
        .appending(path: "Argo", directoryHint: .isDirectory)
        .appending(path: "projects.json")

    private let fileURL: URL
    private let engine: Engine

    public init(fileURL: URL = ProjectRegistryStore.defaultFileURL, engine: Engine = Engine()) {
        self.fileURL = fileURL
        self.engine = engine
    }

    /// A registry that cannot be read is an empty one: a machine that never registered, a
    /// half-written file, a hand-edit gone wrong. Launching into an empty strip is recoverable;
    /// refusing to launch is not.
    public func load() -> ProjectRegistry {
        guard let data = try? Data(contentsOf: fileURL),
              let registry = try? JSONDecoder().decode(ProjectRegistry.self, from: data)
        else { return .empty }
        return registry
    }

    /// One git root is one Project: the folder offered is resolved to its repository root first, so
    /// registering a package inside a monorepo registers the monorepo.
    @discardableResult
    public func register(at url: URL) async -> ProjectRegistry {
        let path = await root(of: url).path
        return persist(load().registering(path: path))
    }

    /// Re-point a Project that has moved. Resolved the same way registration is, so a folder
    /// dragged inside its own repository re-points to the repository, not to the folder.
    @discardableResult
    public func relocate(id: String, to url: URL) async -> ProjectRegistry {
        let path = await root(of: url).path
        return persist(load().relocating(id: id, path: path))
    }

    @discardableResult
    public func activate(id: String) -> ProjectRegistry {
        persist(load().activating(id: id))
    }

    private func root(of url: URL) async -> URL {
        await engine.checkout(at: url).repositoryURL.standardizedFileURL
    }

    /// A registry that cannot be written is still the registry this process will use: the switch
    /// takes for this launch and is forgotten by the next one. Refusing the switch is a worse
    /// answer to a full disk than losing the memory of it.
    private func persist(_ registry: ProjectRegistry) -> ProjectRegistry {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        do {
            try FileManager.default.createDirectory(
                at: fileURL.deletingLastPathComponent(),
                withIntermediateDirectories: true,
            )
            try encoder.encode(registry).write(to: fileURL, options: .atomic)
        } catch {
            return registry
        }
        return registry
    }
}
