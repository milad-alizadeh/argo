/// The shortest suffix of a path that tells it apart from the others it is listed beside —
/// the leaf alone where it is unambiguous, the nearest distinguishing parent where it is not.
enum DistinguishingLabel {
    /// Capped at one parent, so a label can never grow into the path it is standing in for:
    /// "absolute paths never appear in the default presentation" (#377). Where that leaves two
    /// entries reading alike, they read alike — the full path belongs to hover and disclosure.
    private static let depth = 2

    /// `nil` where a path has no components to name it by; the caller owns how it spells that
    /// absence.
    static func labels(for paths: [String?]) -> [String?] {
        let components = paths.map(components(of:))
        return components.indices.map { label(at: $0, among: components) }
    }

    /// Split rather than resolved: a relative path resolved against the process cwd would take
    /// ancestry the record never carried, and a fabricated qualifier is the hardest kind to spot.
    private static func components(of path: String?) -> [String] {
        guard let path else { return [] }
        return path.split(separator: "/").map(String.init)
    }

    private static func label(at index: Int, among paths: [[String]]) -> String? {
        let path = paths[index]
        guard let name = path.last else { return nil }
        // An exact twin is not a rival: no label separates two entries on one path, and
        // treating it as one is what used to push the qualifier out to the whole path.
        let rivals = paths.indices
            .filter { $0 != index && paths[$0] != path && paths[$0].last == name }
        guard !rivals.isEmpty, path.count > 1 else { return name }
        for count in 2 ... min(path.count, depth) {
            let candidate = path.suffix(count)
            if rivals.allSatisfy({ paths[$0].suffix(count) != candidate }) {
                return candidate.joined(separator: "/")
            }
        }
        return path.suffix(depth).joined(separator: "/")
    }
}
