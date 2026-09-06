/// What the map's regions ARE: the folders the repository keeps its files in, or the subjects the
/// inference guessed at (#1158).
///
/// Two readings of one repository, and the reader's choice between them. The folder tree files
/// code by layer and nothing files it by subject, so a subject is spread over five plates until
/// something re-tiles the map by one — which is what `AtlasMap.regrouped()` does, and this is the
/// value that says whether it was done.
///
/// It travels beside the Map rather than inside it, for the reason `AtlasChannels` does: a Map is
/// what was measured, and how a reader is looking at it is not a fact about the repository.
public enum AtlasGrouping: String, Equatable, Sendable, CaseIterable {
    /// Where the repository put the files.
    case folders

    /// Where the inference guessed they belong. INFERRED, never measured — every surface that
    /// draws this says so.
    case domains
}

/// Which Domain a file was placed in, on a map tiled by domain (#1158).
///
/// Nothing at all on a map tiled by folder, which is what keeps the two readings apart in one
/// type: a file's colour is its measured band there, and a domain rank would be a second claim on
/// the same rectangle.
public enum AtlasTileDomain: Equatable, Sendable {
    /// The Domain's place in the inference's own order, largest first — the rank its colour is
    /// taken at — and how surely the file holds it, which its colour is washed out by.
    case placed(rank: Int, confidence: Double)

    /// The inference declined to place the file. Not a weaker reading of a Domain: nothing the
    /// file is called or changes with put it with a group, and the map says so rather than
    /// guessing.
    case unassigned
}
