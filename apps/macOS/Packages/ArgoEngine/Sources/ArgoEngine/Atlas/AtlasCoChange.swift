import AtlasLayout

/// Which files keep changing in the same commit, counted from git's history alone (#1149).
///
/// The one coupling signal every repository has with no prior setup, and the only one that sees a
/// dependency no import declares. Counted here rather than taken from a tool's export because the
/// two thresholds below decide the answer: CodeCharta's own coupling export reached 240 of this
/// repository's 1,547 files, and counting it with these thresholds reached 1,380.
enum AtlasCoChange {
    /// How many neighbours a file may keep. It bounds the FILE rather than the repository, so the
    /// couplings grow with the file count and not with how busy the history is — a global
    /// threshold instead makes an active repository enormous and a quiet one empty.
    static let neighbours = 20

    /// The share of commits kept, by size. A sweeping commit — a package renamed, a formatter run,
    /// a licence header — couples everything it touched to everything else it touched, and one of
    /// them can outweigh the rest of the history. The cap is the repository's OWN 90th percentile
    /// rather than a number chosen here, so a repository of small commits is not punished for it.
    static let commitSizeQuantile = 0.9

    /// The Couplings among `paths`, counted over what each commit touched.
    ///
    /// `paths` is every path the Map holds a Plot for, named as git names it. A path git has
    /// history for and the working tree does not — a file committed and later deleted — is company
    /// nobody can be shown, and it is dropped BEFORE the size cap, so the cap measures the commits
    /// as the map sees them rather than as git wrote them.
    ///
    /// What comes back is named from the Map's root down, because that is where a Coupling is
    /// read: `AtlasNesting` puts every measured file under a root Plate carrying the repository's
    /// own name, and a Coupling naming a path no Plot sits at cannot be written at all.
    static func couplings(
        over commits: [[String]],
        among paths: [String],
        under root: String,
    )
        -> [AtlasCoupling] {
        // A repository of ONE commit states nothing: every file in it arrived together, which is
        // not the same fact as changing together, and Jaccard over a single commit would read the
        // whole first import as perfectly coupled.
        guard commits.count > 1 else { return [] }
        var place: [String: Int] = [:]
        for (index, path) in paths.enumerated() {
            place[path] = index
        }
        let touched = commits
            .map { commit in commit.compactMap { place[$0] }.sorted() }
            .filter { $0.count > 1 }
        let cap = cap(of: touched)
        return couplings(
            among: paths.map { root + "/" + $0 },
            over: touched.filter { $0.count <= cap },
        )
    }

    /// The size no kept commit is larger than. Nothing at all for a history that paired nothing,
    /// which is what a repository of one commit gets.
    private static func cap(of touched: [[Int]]) -> Int {
        let sizes = touched.map(\.count).sorted()
        guard !sizes.isEmpty else { return 0 }
        return sizes[Int(Double(sizes.count) * commitSizeQuantile)]
    }

    private static func couplings(among paths: [String], over kept: [[Int]]) -> [AtlasCoupling] {
        var changes: [Int: Int] = [:]
        var shared: [Pair: Int] = [:]
        for files in kept {
            for file in files {
                changes[file, default: 0] += 1
            }
            for (offset, file) in files.enumerated() {
                for other in files[(offset + 1)...] {
                    shared[Pair(first: file, second: other), default: 0] += 1
                }
            }
        }
        return strongest(strengths(of: shared, against: changes)).map { pair, strength in
            AtlasCoupling(
                first: paths[pair.first], second: paths[pair.second], strength: strength,
            )
        }
    }

    /// Jaccard: the commits that touched both over the commits that touched either. Not a raw
    /// count and not shared over the larger of the two, because a file that changes on every
    /// commit would otherwise read as coupled to the whole repository, which is a fact about that
    /// file and never about a pair.
    private static func strengths(
        of shared: [Pair: Int],
        against changes: [Int: Int],
    )
        -> [Pair: Double] {
        shared.reduce(into: [:]) { strengths, entry in
            let either = (changes[entry.key.first] ?? 0) + (changes[entry.key.second] ?? 0)
                - entry.value
            guard either > 0 else { return }
            strengths[entry.key] = Double(entry.value) / Double(either)
        }
    }

    /// The strongest `neighbours` of every file, then the union of both files' lists, so a pair
    /// either file kept survives. Ties break on the neighbour's own position: Swift's sort is not
    /// stable, and two equal strengths would otherwise put a different pair in the file on every
    /// run of the same measurement.
    private static func strongest(_ strengths: [Pair: Double]) -> [(Pair, Double)] {
        var near: [Int: [(Int, Double)]] = [:]
        for (pair, strength) in strengths {
            near[pair.first, default: []].append((pair.second, strength))
            near[pair.second, default: []].append((pair.first, strength))
        }
        var pairs: Set<Pair> = []
        for (file, list) in near {
            let closest = list
                .sorted { left, right in
                    left.1 == right.1 ? left.0 < right.0 : left.1 > right.1
                }
                .prefix(neighbours)
            for (other, _) in closest {
                pairs.insert(Pair(first: file, second: other))
            }
        }
        // In the Map's own order, so one measurement writes one file however the counting reached
        // it, and two Map files can be compared line by line.
        return pairs
            .sorted { ($0.first, $0.second) < ($1.first, $1.second) }
            .map { ($0, strengths[$0] ?? 0) }
    }
}

/// Two files, by their positions in the Map. Ordered on the way in, so one pair is one key however
/// the commit listed the two files.
private struct Pair: Hashable {
    let first: Int
    let second: Int

    init(first: Int, second: Int) {
        self.first = min(first, second)
        self.second = max(first, second)
    }
}
