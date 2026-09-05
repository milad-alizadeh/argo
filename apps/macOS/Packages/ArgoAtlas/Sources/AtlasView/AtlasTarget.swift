/// What one box of the map IS: a file to read, or a folder to go into (#1156).
///
/// A closed kind rather than a path and a flag beside it, because the two mean different things to
/// do — a file opens a reading and a folder re-tiles the map — and a caller handed a bare path
/// would have to ask the Map which it was looking at, against a Map that may have been narrowed
/// since the frame was drawn.
///
/// Both carry the whole path from the Map's root down, which is the join key everywhere else: the
/// index rows, the trace on the map, the reading panel and the trail all key off it.
public enum AtlasTarget: Equatable, Sendable {
    case file(String)
    case folder(String)

    /// The FILE this names, and nothing where it names a folder — the one question asked of a
    /// target often enough to be spelled once: the hover strip names files, and so does the trace
    /// on the map.
    public var file: String? {
        guard case let .file(path) = self else { return nil }
        return path
    }
}
