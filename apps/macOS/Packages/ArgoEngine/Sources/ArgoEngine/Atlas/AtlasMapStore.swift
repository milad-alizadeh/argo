import AtlasLayout
import Foundation

/// The per-machine Map files, and the only thing that writes one (#1148).
///
/// Owned state, never committed: a measurement of a checkout on this machine belongs beside the
/// registry that names the Project, not in the repository it measured. One file per Project, keyed
/// on the Project's id rather than its path, so a Project that moves keeps the Map it already has.
///
/// An actor for the reason `AtlasMapGenerator` is one: it spawns processes and opens files, and its
/// caller is the main actor (ADR-0028 rule 6).
public actor AtlasMapStore {
    /// `userData` in the Electron shell's spelling, one folder down from the registry.
    public static let defaultDirectoryURL = URL.applicationSupportDirectory
        .appending(path: "Argo", directoryHint: .isDirectory)
        .appending(path: "atlas", directoryHint: .isDirectory)

    private let directoryURL: URL
    private let generator: AtlasMapGenerator

    public init(directoryURL: URL = AtlasMapStore.defaultDirectoryURL) {
        self.init(directoryURL: directoryURL, generator: AtlasMapGenerator())
    }

    init(directoryURL: URL, generator: AtlasMapGenerator) {
        self.directoryURL = directoryURL
        self.generator = generator
    }

    /// Where one Project's Map file sits. A Project's id is a UUID, so it names a file as it
    /// stands.
    nonisolated public func fileURL(of project: ProjectRecord) -> URL {
        directoryURL.appending(path: project.id + ".json")
    }

    /// Measures the Project's repository and writes the Map. The answer is returned whether or not
    /// the file could be written: a full disk costs the reader the next open's speed, and refusing
    /// them the map they asked for would be the worse answer to it.
    @discardableResult
    public func generate(for project: ProjectRecord) async -> AtlasMap {
        let map = await generator.measure(at: project.url)
        guard let data = try? map.encoded() else { return map }
        try? FileManager.default.createDirectory(
            at: directoryURL, withIntermediateDirectories: true,
        )
        try? data.write(to: fileURL(of: project), options: .atomic)
        return map
    }

    /// The Map already measured for this Project, or `nil` where none has been. The two are
    /// different instructions to the reader — "nothing has been measured, rebuilding will" against
    /// "the measurement could not be read" — so a file that is not there is not an error and a
    /// file that will not parse is.
    public func map(of project: ProjectRecord) throws(AtlasMapError) -> AtlasMap? {
        let fileURL = fileURL(of: project)
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return nil }
        // Asked separately from the decode so a file that is THERE and will not open — a permission
        // this process does not have, a disk that went away — reads as unreadable rather than as a
        // Project nobody has measured.
        guard let data = try? Data(contentsOf: fileURL) else {
            throw .unreadable("the Map file could not be opened")
        }
        return try AtlasMap(decoding: data)
    }
}
