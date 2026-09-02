import Foundation

/// One Turn's stretch of the reading — the semantic block the lane draws a line beside (#382).
struct MinimapTurn: Equatable, Sendable {
    /// The rows it holds, both ends included.
    package let rows: ClosedRange<Int>
    /// What it opened with. `nil` for a promptless exchange — a resumed Session's first stretch has
    /// no prompt in the record, and inventing one would put words in somebody's mouth.
    let prompt: String?
}

extension MinimapTurn {
    /// The Turns in a reading, broken where the feed itself breaks — the boundaries are
    /// `TurnExtents`', shared with the feed's own Copy turn so the two cannot disagree.
    static func extents(of rows: [MinimapRow]) -> [MinimapTurn] {
        TurnExtents.spans(of: TurnExtents.Reading(
            count: rows.count,
            opensTurn: { rows[$0].prompt != nil },
            endsTurn: { rows[$0].endsTurn },
        ))
        .map { MinimapTurn(rows: $0, prompt: rows[$0.lowerBound].prompt) }
    }
}
