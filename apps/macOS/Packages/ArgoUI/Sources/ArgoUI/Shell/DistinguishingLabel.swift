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
        labelling(paths).labels
    }

    /// The same labels, and how many paths the pass LOOKED AT to reach them: one look per path to
    /// build the index, and one per rival at each address it labels. A pass that asked every path
    /// which others share its name looks at all of them at every address, which is the same count
    /// squared.
    ///
    /// That count is what `FeedScaleTests` gates this rule at, because "grows with the record and
    /// not with the square of it" is a COUNT and never a duration (ADR-0028 Rule 8): a count is
    /// exactly the same idle and loaded. Returned per call rather than tallied on a static, which
    /// every suite running beside that one would share. Counted in both configurations, because an
    /// accumulator in a pass that already runs is control flow rather than an instrument.
    static func labelling(_ paths: [String?]) -> (labels: [String?], looks: Int) {
        let components = paths.map(components(of:))
        let rivalry = rivalry(among: components)
        var looks = components.count
        let labels = components.map { path -> String? in
            let sharing = rivalry[path.last ?? "", default: []]
            looks += sharing.count
            return label(for: path, among: sharing)
        }
        return (labels, looks)
    }

    /// Every DISTINCT path that ends in a given name, indexed by that name.
    ///
    /// Indexed because asking each path which others it must be told apart from is a scan of the
    /// whole list per entry — quadratic on a feed of six hundred rows.
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
