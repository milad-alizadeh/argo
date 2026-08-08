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
        let rivalry = rivalry(among: components)
        return components.map { label(for: $0, among: rivalry[$0.last ?? "", default: []]) }
    }

    /// Every DISTINCT path that ends in a given name, indexed by that name.
    ///
    /// The index is what makes this usable on a real session. Asking each path which of the others
    /// it has to be told apart from is a scan of the whole list per entry, which is fine for a
    /// roster of six workspaces and quadratic for a feed of six hundred rows — the same rule,
    /// answered once per name instead of once per pair.
    ///
    /// Distinct, because an exact twin is not a rival: no label separates two entries on one path.
    private static func rivalry(among paths: [[String]]) -> [String: Set<[String]>] {
        paths.reduce(into: [:]) { found, path in
            guard let name = path.last else { return }
            found[name, default: []].insert(path)
        }
    }

    /// Split rather than resolved: a relative path resolved against the process cwd would take
    /// ancestry the record never carried, and a fabricated qualifier is the hardest kind to spot.
    private static func components(of path: String?) -> [String] {
        guard let path else { return [] }
        return path.split(separator: "/").map(String.init)
    }

    private static func label(for path: [String], among sharing: Set<[String]>) -> String? {
        guard let name = path.last else { return nil }
        let rivals = sharing.subtracting([path])
        guard !rivals.isEmpty, path.count > 1 else { return name }
        for count in 2 ... min(path.count, depth) {
            let candidate = Array(path.suffix(count))
            if rivals.allSatisfy({ Array($0.suffix(count)) != candidate }) {
                return candidate.joined(separator: "/")
            }
        }
        return path.suffix(depth).joined(separator: "/")
    }
}
