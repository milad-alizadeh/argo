import AtlasLayout

/// Which files keep changing in the same commit, counted from git's history alone (#1149).
///
/// The one coupling signal every repository has with no prior setup, and the only one that sees a
/// dependency no import declares. Counted here rather than taken from a tool's export because the
/// two thresholds below decide the answer: CodeCharta's own coupling export reached 240 of this
/// repository's 1,547 files, and counting it with these thresholds reached 1,380.
///
/// A RENAMED file is two files here, because the log this reads is asked for with `--no-renames`
/// so that no machine's `diff.renames` can change what Argo measured (`AtlasHistory`). What that
/// costs is company: a file's history stops at its last rename, so the pairs before it are lost
/// and what remains is counted over a shorter history. Undercounting rather than inventing,
/// which is the direction to be wrong in, and the fix is one log pass away when a ticket wants it.
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
        return counted(
            over: touched.filter { $0.count <= cap },
            among: paths.map { root + "/" + $0 },
        )
    }

    /// The size no kept commit is larger than. Nothing at all for a history that paired nothing,
    /// which is what a repository of one commit gets.
    private static func cap(of touched: [[Int]]) -> Int {
        let sizes = touched.map(\.count).sorted()
        guard !sizes.isEmpty else { return 0 }
        return sizes[Int(Double(sizes.count) * commitSizeQuantile)]
    }

    /// The kept commits, paired: how often each file changed, how often each pair changed
    /// together, and which of those pairs each file holds on to.
    private static func counted(over kept: [[Int]], among paths: [String]) -> [AtlasCoupling] {
        var changes: [Int: Int] = [:]
        var shared: [AtlasPair: Int] = [:]
        for files in kept {
            for file in files {
                changes[file, default: 0] += 1
            }
            for (offset, file) in files.enumerated() {
                for other in files[(offset + 1)...] {
                    shared[AtlasPair(file, other), default: 0] += 1
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
        of shared: [AtlasPair: Int],
        against changes: [Int: Int],
    )
        -> [AtlasPair: Double] {
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
    private static func strongest(_ strengths: [AtlasPair: Double]) -> [(AtlasPair, Double)] {
        var near: [Int: [(Int, Double)]] = [:]
        for (pair, strength) in strengths {
            near[pair.first, default: []].append((pair.second, strength))
            near[pair.second, default: []].append((pair.first, strength))
        }
        var pairs: Set<AtlasPair> = []
        for (file, list) in near {
            let closest = list
                .sorted { left, right in
                    left.1 == right.1 ? left.0 < right.0 : left.1 > right.1
                }
                .prefix(neighbours)
            for (other, _) in closest {
                pairs.insert(AtlasPair(file, other))
            }
        }
        // In the Map's own order, so one measurement writes one file however the counting reached
        // it, and two Map files can be compared line by line.
        return pairs.sorted().map { ($0, strengths[$0] ?? 0) }
    }
}
