import AtlasLayout
import Foundation

/// The per-machine written layer files, and the one thing that reads one (#1159).
///
/// **A store of its own, beside `AtlasMapStore` and never inside it.** That is the ticket's own
/// rule made structural: the map is drawn from the Map file alone, this is fetched separately, and
/// a Project whose written layer is missing draws exactly the same map. A caller that never asks
/// gets a map that cost it nothing.
///
/// **Nothing here writes one.** Notes are written by reading the code, which is a model's work and
/// not a measurement — the Atlas's own rebuild says "no model calls" and means it. The file is put
/// beside the Map by whatever wrote it; this reads it if it is there.
///
/// An actor for `AtlasMapStore`'s reason: it opens files, and its caller is the main actor
/// (ADR-0028 rule 6).
public actor AtlasNotesStore {
    /// Beside the Map files, because they are two readings of one Project and a reader looking for
    /// either should find both in one folder.
    public static let defaultDirectoryURL = AtlasMapStore.defaultDirectoryURL

    private let directoryURL: URL

    public init(directoryURL: URL = AtlasNotesStore.defaultDirectoryURL) {
        self.directoryURL = directoryURL
    }

    /// Where one Project's written layer sits. The Project's id names it, like its Map, so a
    /// Project that moves keeps whatever was written about it.
    nonisolated public func fileURL(of project: ProjectRecord) -> URL {
        directoryURL.appending(path: project.id + ".notes.json")
    }

    /// What was written about this Project, read against the repository as it stands — or nothing
    /// said, which is what every failure here comes to.
    ///
    /// **Absence is not an error and neither is anything else.** No file, a half-written file, a
    /// file from another tool, a file from a later Argo: all four leave the reader with the map
    /// they came for and no sentence beside it. The Map's reader is the opposite and deliberately
    /// so — a Map that will not read is the thing the reader asked for going missing.
    ///
    /// The Map is taken in because it is what says which paths are real and what the repository's
    /// own root is called. Only a subject the Map holds a Plot for is opened: a written layer
    /// taken before a rename names files that are not on the map, and this reads no file the map
    /// is not already drawing.
    public func notes(of project: ProjectRecord, in map: AtlasMap) -> AtlasNotes {
        guard let data = try? Data(contentsOf: fileURL(of: project)),
              let notes = AtlasNotes(decoding: data)
        else {
            return .none
        }
        return notes.checked(against: digests(for: notes, of: project, in: map))
    }

    /// What each recorded subject holds now. A subject the Map does not draw, or that no longer
    /// opens, is left out — which leaves its Note unchecked rather than stale, because a check
    /// that could not run is not a finding.
    private func digests(
        for notes: AtlasNotes,
        of project: ProjectRecord,
        in map: AtlasMap,
    )
        -> [String: String] {
        let drawn = Set(map.plots.map(\.path))
        var digests: [String: String] = [:]
        for path in notes.subjects where drawn.contains(path) {
            guard let fileURL = AtlasSubject.url(
                of: path, under: project.url, inside: map.root.path,
            ) else {
                continue
            }
            digests[path] = AtlasSubject.digest(of: fileURL)
        }
        return digests
    }
}
