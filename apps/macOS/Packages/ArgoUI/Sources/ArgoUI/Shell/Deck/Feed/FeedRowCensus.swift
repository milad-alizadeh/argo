import ArgoEngine

/// How many rows of each shape a transcript's lines project to, counted in one place.
///
/// Two targets ask it of the same lines — the fixture's generator, which will not write a
/// synthetic that projects differently from its source, and the suite that holds the checked-in
/// synthetic to what was written. Two spellings of it would let those answers disagree for a
/// reason that is about neither file, and this is the only module both can see: `ArgoFixtures`
/// may not import a view (`swift-boundaries.sh` edge 8), and a test helper is not visible to an
/// executable.
package enum FeedRowCensus {
    /// The counts, by the name each row shape carries — `rows` for the total, `rows.<shape>` for
    /// each kind, so a caller folds them straight into whatever else it counts.
    package static func counts(ofLines lines: [String]) async -> [String: Int] {
        let reader = TranscriptReader()
        let rows = await FeedProjection.rows(from: reader.read(lines: lines))
        return rows.reduce(into: ["rows": rows.count]) { counts, row in
            counts["rows.\(row.content.shape.rawValue)", default: 0] += 1
        }
    }
}
