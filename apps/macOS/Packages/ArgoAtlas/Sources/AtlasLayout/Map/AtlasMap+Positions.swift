/// Where a Plot sits, looked up both ways (#1145, #1157).
///
/// The file names every Plot once, in the nesting, and every reading ACROSS Plots — a Coupling's
/// two ends, a Domain's members — spells its ends as positions in that order rather than as paths.
/// So both directions of that lookup are one thing, shared by the two readings that make it.
extension AtlasMap {
    /// The Plot a position names, and the caller's own account of a position naming none: a
    /// Coupling and a Domain fail differently over the same off-by-one, and the log is what says
    /// which half of the file disagreed with the nesting.
    static func plotPath(
        at position: Int,
        among plots: [AtlasPlot],
        missing: (Int) -> AtlasMapError,
    ) throws(AtlasMapError)
        -> String {
        guard plots.indices.contains(position) else { throw missing(position) }
        return plots[position].path
    }

    /// Where a path sits in the Map's Plot order, and the caller's own account of a path that
    /// sits nowhere.
    static func place(
        of path: String,
        in position: [String: Int],
        missing: (String) -> AtlasMapError,
    ) throws(AtlasMapError)
        -> Int {
        guard let found = position[path] else { throw missing(path) }
        return found
    }
}
