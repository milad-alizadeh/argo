import Foundation
import ProseText

/// The whole-document measure, off the main actor and across cores (ADR-0030, Rule 3).
///
/// Nothing here decides anything: it is handed a stamp — the rows, how each stands, the width and
/// the ink — and hands back a height for every row of it, or for the rows it was asked about. What
/// to measure is `FeedMeasureDelta`'s and when to draw it is the coordinator's.
///
/// Why it can run here at all: a row's height is arithmetic or Core Text and no longer a SwiftUI
/// layout pass (ADR-0030, Rule 1), and Core Text framesetters are per-row and thread-safe. The
/// stores under it were the main actor's by this repo's convention rather than the platform's, and
/// ADR-0030 is where that convention was spent — see `ProseStore`.
enum FeedMeasurePass {
    /// Every row of the stamp, measured. `nil` only where the stamp holds no rows to measure,
    /// which is not a document.
    static func settle(_ stamp: FeedMeasureStamp) async -> FeedSettledDocument? {
        // The stores are held to the document before a row of it is read: a ceiling under the
        // length of the walk is a store that has evicted its own head by the time the walk wraps,
        // so every pass pays every parse (`ProseCache`).
        ProseReading.holding(rows: stamp.rows.count)
        let measured = await measure(IndexSet(stamp.rows.indices), of: stamp)
        let heights = stamp.rows.indices.map { measured[$0] ?? FeedMeasurePass.unmeasured }
        return FeedSettledDocument(stamp: stamp, heights: heights)
    }

    /// The named rows, measured — the tail a live Session grew and the row a late Result changed
    /// (ADR-0030, Rule 5) both come through here.
    ///
    /// Run twice at most. The first run notes every face it could not be answered for, because a
    /// hosting ruler is the main actor's and this is not (`ProseWarmth`); those faces are then
    /// measured on the main actor and the rows re-measured over them. After the first document of
    /// a process there is nothing left to warm and the second run does not happen.
    static func measure(_ rows: IndexSet, of stamp: FeedMeasureStamp) async -> [Int: CGFloat] {
        let warmth = ProseWarmth()
        let measured = await ProseWarmth.$owed.withValue(warmth) { await across(rows, of: stamp) }
        guard !warmth.isEmpty else { return measured }
        // One hop per face, not one for the list: a probe is a hosting ruler and the main actor is
        // where one runs, so a warm taken in a single hop is the whole list's worth of layout
        // inside one frame. Split, the reader gets the main actor back between faces.
        //
        // It happens once per face per process — the first Session of a launch pays it, and every
        // switch after it is warm.
        for face in warmth.owing {
            await MainActor.run {
                ProseLineBox.warm([face])
                ProseBaseline.warm([face])
            }
        }
        return await across(rows, of: stamp)
    }

    /// What a row that could not be measured at all stands at — a row index outside the stamp,
    /// which `settle` cannot produce and which exists so the map above has no optional in it.
    private static let unmeasured = FeedTableCoordinator.estimatedRowHeight

    /// The rows split into chunks, one child task each.
    ///
    /// Chunked rather than one task a row: a 4 800-row document is 4 800 tasks whose scheduling
    /// costs more than the arithmetic rows they carry, and a chunk is what makes the Core Text
    /// rows — the expensive ones — worth a core.
    private static func across(_ rows: IndexSet, of stamp: FeedMeasureStamp) async
        -> [Int: CGFloat] {
        let chunks = chunked(Array(rows))
        return await withTaskGroup(of: [Int: CGFloat].self) { group in
            for chunk in chunks {
                group.addTask { measured(chunk, of: stamp) }
            }
            return await group.reduce(into: [:]) { measured, chunk in
                measured.merge(chunk) { _, fresh in fresh }
            }
        }
    }

    /// One chunk, measured where it stands. Synchronous on purpose: a chunk is the unit of work a
    /// core takes, and an await inside it would hand the rows back to the scheduler one at a time.
    private static func measured(_ chunk: [Int], of stamp: FeedMeasureStamp) -> [Int: CGFloat] {
        var measured: [Int: CGFloat] = [:]
        for index in chunk {
            // A width burst arms a pass a frame and retires all but the last. Answered per row and
            // not per chunk, because a chunk of a long document is most of a document.
            guard !Task.isCancelled else { return measured }
            measured[index] = height(at: index, of: stamp)
        }
        return measured
    }

    /// A row's whole height, the same way the table used to ask for one on the spot: the step above
    /// it, which is a fact about the PAIR of rows, and the row's own shape.
    ///
    /// Rounded UP to a whole point: a non-integral row height still blurs baselines on current
    /// macOS, and up rather than to-nearest so text is never clipped by rounding.
    static func height(at index: Int, of stamp: FeedMeasureStamp) -> CGFloat {
        guard stamp.rows.indices.contains(index) else { return unmeasured }
        let row = stamp.rows[index]
        let step = FeedRow.step(to: row, from: index > 0 ? stamp.rows[index - 1] : nil)
        let shape = FeedShapeHeight(standing: stamp.standing(at: index), measure: stamp.measure)
        return FeedTableCoordinator.usableHeight(ceil(step + shape.height(of: row.content)))
    }

    /// How many rows a chunk holds. Sized so a document of any length lands on every core the box
    /// has without splitting into tasks smaller than the work in them.
    private static func chunked(_ rows: [Int]) -> [[Int]] {
        let cores = max(1, ProcessInfo.processInfo.activeProcessorCount)
        let size = max(Self.leastChunk, (rows.count + cores - 1) / cores)
        return stride(from: 0, to: rows.count, by: size).map {
            Array(rows[$0 ..< min($0 + size, rows.count)])
        }
    }

    /// The fewest rows worth a task of its own. Below this the scheduling costs more than the
    /// measuring, which is every re-measure of a tail or of one changed row.
    private static let leastChunk = 32
}
