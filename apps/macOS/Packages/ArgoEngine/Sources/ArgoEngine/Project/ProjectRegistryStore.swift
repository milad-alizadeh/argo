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
    /// registering a package inside a monorepo registers the monorepo — and the Project returned is
    /// the one at that root, whether this call created it or it was already known.
    @discardableResult
    public func register(at url: URL) async -> ProjectChange {
        let path = await projectRoot(of: url).path
        return change(persist(load().registering(path: path)), atPath: path)
    }

    /// Re-point a Project that has moved. Resolved the same way registration is, so a folder
    /// dragged inside its own repository re-points to the repository, not to the folder.
    @discardableResult
    public func relocate(id: String, to url: URL) async -> ProjectChange {
        let path = await projectRoot(of: url).path
        return change(persist(load().relocating(id: id, path: path)), atPath: path)
    }

    /// Forget a Project. `project` answers where the cockpit lands afterwards — the active Project
    /// once the record is gone — and is absent when the set has emptied, which is the one case the
    /// caller has to render rather than switch to.
    @discardableResult
    public func remove(id: String) -> ProjectChange {
        let registry = persist(load().removing(id: id))
        return ProjectChange(registry: registry, project: registry.active)
    }

    /// Record a validated Binding. Deliberately **not** `public`: bind-time validation is the whole
    /// argument for the Binding level, and a door into the registry that skips it would persist a
    /// Binding that reads empty. `ProjectBindings` is the only caller, and the only public way in.
    @discardableResult
    func bind(_ binding: ProjectBinding, to projectID: String) -> ProjectChange {
        let registry = persist(load().replacingBinding(binding, of: projectID))
        return ProjectChange(registry: registry, project: registry.project(id: projectID))
    }

    @discardableResult
    func unbind(port: AccountPort, from projectID: String) -> ProjectChange {
        let registry = persist(load().removingBinding(port: port, of: projectID))
        return ProjectChange(registry: registry, project: registry.project(id: projectID))
    }

    @discardableResult
    public func activate(id: String) -> ProjectChange {
        let registry = persist(load().activating(id: id))
        return ProjectChange(registry: registry, project: registry.project(id: id))
    }

    /// Which Project a folder belongs to, before anything is written. What a caller that has to
    /// compare a path against the registry needs, since the registry holds roots and not folders.
    public func projectRoot(of url: URL) async -> URL {
        await engine.checkout(at: url).repositoryURL.standardizedFileURL
    }

    private func change(_ registry: ProjectRegistry, atPath path: String) -> ProjectChange {
        ProjectChange(registry: registry, project: registry.project(atPath: path))
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
            // Nothing to recover: the registry below is the answer either way.
        }
        return registry
    }
}
