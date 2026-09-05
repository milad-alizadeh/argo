/// How far two partitions of the same files agree (#1157).
///
/// The Rand index: over the file PAIRS both partitions have an opinion about, how often do they
/// agree that the two files belong together — or agree that they do not. It is the only accuracy
/// number available here, because there is no answer key: nobody has labelled this repository's
/// domains, and the literature's own evaluations disagree by fifty points across codebases. Two
/// independent readings agreeing is not proof they are right, and it is what there is.
///
/// Computed exactly from the contingency table rather than sampled over pairs. Sampled, the
/// resolution sweep below it became random, and two runs over one unchanged repository drew
/// different maps — disqualifying for the one number standing in for accuracy.
enum AtlasAgreement {
    /// The Rand index of two partitions, 0 to 1, over the files BOTH placed. A file either
    /// partition left out of everything is not evidence either way, and `nil` where fewer than
    /// two files are left, which has no pairs to agree about.
    ///
    /// A community of `unplaced` is what "belongs to nothing" is spelled as, on both sides.
    static func between(_ one: [Int], _ other: [Int]) -> Double? {
        var cells: [Cell: Int] = [:]
        var rows: [Int: Int] = [:]
        var columns: [Int: Int] = [:]
        var placed = 0
        for (left, right) in zip(one, other) where left != unplaced && right != unplaced {
            placed += 1
            cells[Cell(row: left, column: right), default: 0] += 1
            rows[left, default: 0] += 1
            columns[right, default: 0] += 1
        }
        guard placed > 1 else { return nil }
        let together = pairs(among: cells.values)
        let all = Double(placed * (placed - 1) / 2)
        return (all - pairs(among: rows.values) - pairs(among: columns.values) + 2 * together)
            / all
    }

    /// What a file that belongs to nothing is spelled as. Negative rather than an optional so the
    /// membership pass and the partitions it is compared against are one shape.
    static let unplaced = -1

    /// How many pairs the counts hold between them.
    private static func pairs(among counts: some Collection<Int>) -> Double {
        counts.reduce(0) { $0 + Double($1 * ($1 - 1) / 2) }
    }

    /// One cell of the contingency table: how many files this community of the first partition
    /// and that community of the second hold in common. ORDERED, unlike `AtlasPair` — the two
    /// partitions number their communities in different spaces, so a cell read either way round
    /// would fold two different counts into one.
    private struct Cell: Hashable {
        let row: Int
        let column: Int
    }
}
