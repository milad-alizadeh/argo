import Foundation

/// The written layer of one Project: what somebody wrote about its files and folders (#1159).
///
/// **Optional and separate, on purpose.** Measured numbers draw the map; these live in a file of
/// their own, are fetched separately, and a repository without them draws exactly the same map.
/// That separation is what lets the Atlas work on any repository with no prior setup, and it is
/// worth protecting when it becomes inconvenient — which is why nothing here is reachable from
/// `AtlasMap`, and why no Measure, band or tile is derived from a Note.
///
/// Keyed by the Map's own paths, so a Note joins the thing it was written about on the one key the
/// whole Atlas runs on. A key naming nothing on the map is simply never asked for: it costs the
/// reader nothing and is what a written layer taken before a rename leaves behind.
public struct AtlasNotes: Equatable, Sendable {
    /// The shape this reader writes and the only one it reads, for `AtlasMap.version`'s reason: a
    /// file written by a later Argo can say so rather than be read against this idea of a Note.
    public static let version = 1

    /// When the layer was written, and by what. Provenance rather than decoration: a sentence a
    /// model wrote about somebody's code is worth reading only if the reader can see it was.
    public let writtenAt: Date?
    public let model: String?

    /// One Note per file, by the Map's path.
    public let files: [String: AtlasNote]

    /// One caption per folder, by the Map's path. A different subject from a file and not a
    /// fallback for one: a caption says what lives in a place, a note says what one file is for.
    public let folders: [String: AtlasNote]

    /// A Project nobody has written about — the reading every repository gets until a written
    /// layer is put beside it, and the one every repository is entitled to keep.
    public static let none = AtlasNotes()

    public init(
        writtenAt: Date? = nil,
        model: String? = nil,
        files: [String: AtlasNote] = [:],
        folders: [String: AtlasNote] = [:],
    ) {
        self.writtenAt = writtenAt
        self.model = model
        self.files = files
        self.folders = folders
    }

    /// Whether the layer says anything at all about anything.
    public var isEmpty: Bool {
        files.isEmpty && folders.isEmpty
    }

    /// What was written about one file, or nothing.
    public func note(ofFile path: String) -> AtlasNote? {
        files[path]
    }

    /// What was written about one folder, or nothing.
    public func note(ofFolder path: String) -> AtlasNote? {
        folders[path]
    }

    /// Every file a Note recorded a digest of, sorted — what a caller has to digest for
    /// `checked(against:)` to say anything.
    ///
    /// Sorted rather than in the dictionary's own order, for `AtlasMap.measureNames`' reason: a
    /// set walked in its own order is how one run comes out different from the next, and this list
    /// decides which files are opened.
    public var subjects: [String] {
        files.filter { $0.value.subject != nil }.keys.sorted()
    }

    /// The same layer, every Note read against what its subject holds now — the digests keyed by
    /// the same path the Note is.
    ///
    /// A pure function of the digests handed in, because this package opens no file (ADR-0028
    /// rule 6). A subject missing from `digests` leaves its Note `unchecked` rather than stale:
    /// a check that could not run is not a finding. Folder captions are left alone, because a
    /// folder holds no content of its own to digest.
    public func checked(against digests: [String: String]) -> AtlasNotes {
        var read: [String: AtlasNote] = [:]
        for (path, note) in files {
            read[path] = note.checked(against: digests[path])
        }
        return AtlasNotes(writtenAt: writtenAt, model: model, files: read, folders: folders)
    }
}
