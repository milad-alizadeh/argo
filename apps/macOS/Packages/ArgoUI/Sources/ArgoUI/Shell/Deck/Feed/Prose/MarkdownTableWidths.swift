import Foundation

/// How a pipe table's columns divide the measure it is drawn across.
///
/// The rule is the browser's, because it is the one readers already know: a column asks for the
/// width its widest cell would take on one line, keeps a floor its longest word cannot be broken
/// below, and the slack between the two is shared out in proportion to what each column asked for.
/// The table then spans the measure exactly.
///
/// A `Grid` left to size itself does neither half. Past the measure it shrinks every column to its
/// longest WORD, which is how a four-column table came out a third of the feed wide with every cell
/// wrapped to two syllables — and under the measure it hugs its content and leaves the rest of the
/// column empty.
enum MarkdownTableWidths {
    /// What one column asks for, in points and including its own padding.
    struct Ask: Equatable {
        /// The width its widest cell would take on one line.
        var ideal: CGFloat
        /// The width its longest unbreakable word takes. Never given up.
        var floor: CGFloat
    }

    /// The columns' drawn widths, summing to the measure. The rules take no room of their own: each
    /// is drawn on a cell's own edge, so the columns divide the whole of it.
    static func widths(_ asks: [Ask], across measure: CGFloat) -> [CGFloat] {
        guard !asks.isEmpty else { return [] }
        let room = max(0, measure)
        let floors = asks.map { max(0, $0.floor) }
        let ideals = asks.map { max($0.ideal, $0.floor) }
        // Over-full: every column is at its floor and the floors alone do not fit. Scaled rather
        // than clipped, so the table still ends where the measure does and the wrapping is the
        // cells' own business.
        guard floors.reduce(0, +) < room else { return scaled(floors, to: room) }
        // Room to spare: the asks themselves, grown in proportion so the table fills the measure.
        guard ideals.reduce(0, +) > room else { return scaled(ideals, to: room) }
        return floors.indices.map { column in
            floors[column] + share(of: room - floors.reduce(0, +), at: column, floors, ideals)
        }
    }

    /// One column's cut of the slack above the floors, in proportion to what it still wants. An
    /// equal cut where no column wants anything more, which is every column already at its ideal.
    private static func share(
        of slack: CGFloat,
        at column: Int,
        _ floors: [CGFloat],
        _ ideals: [CGFloat],
    )
        -> CGFloat {
        let wants = floors.indices.map { max(0, ideals[$0] - floors[$0]) }
        let total = wants.reduce(0, +)
        guard total > 0 else { return slack / CGFloat(floors.count) }
        return slack * wants[column] / total
    }

    /// Widths in the same proportions, summing to the room there is.
    private static func scaled(_ widths: [CGFloat], to room: CGFloat) -> [CGFloat] {
        let total = widths.reduce(0, +)
        guard total > 0 else {
            return widths.map { _ in room / CGFloat(widths.count) }
        }
        return widths.map { $0 * room / total }
    }
}
