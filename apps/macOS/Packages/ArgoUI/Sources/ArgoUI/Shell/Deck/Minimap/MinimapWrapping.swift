import Foundation

/// How one row's words really wrapped: per block, how full each of its lines came out, as shares of
/// the measure it was drawn across.
///
/// Measured by the lane through `ProseMetrics` and handed to `MinimapRuns` as a VALUE, so the
/// arithmetic that turns a row into runs still needs no font and no main actor — and so a test can
/// state a wrap rather than reproduce one.
///
/// Empty is a legitimate answer and means "nobody measured": the runs fall back to dividing the
/// character count, which is all a row compressed to a single line can show anyway.
struct MinimapWrapping: Equatable, Sendable {
    /// One entry per block of the row, in the row's own order. A block nobody measured — a fence, a
    /// table, a paragraph the lane compressed — carries an empty one.
    var blocks: [[CGFloat]] = []

    static let unmeasured = MinimapWrapping()

    init(blocks: [[CGFloat]] = []) {
        self.blocks = blocks
    }

    /// One block's measured lines, or `nil` where it has none.
    func lines(of block: Int) -> [CGFloat]? {
        guard blocks.indices.contains(block), !blocks[block].isEmpty else { return nil }
        return blocks[block]
    }

    /// The single block's lines, for the shapes that are one run of words — a plain paragraph row,
    /// a prompt.
    var lines: [CGFloat]? {
        lines(of: 0)
    }
}
