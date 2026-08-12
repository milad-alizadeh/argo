import Foundation

/// One Turn's stretch of the reading — the semantic block the lane draws a line beside (#382).
struct MinimapTurn: Equatable, Sendable {
    /// The rows it holds, both ends included.
    let rows: ClosedRange<Int>
    /// What it opened with. `nil` for a promptless exchange — a resumed Session's first stretch has
    /// no prompt in the record, and inventing one would put words in somebody's mouth.
    let prompt: String?
}

extension MinimapTurn {
    /// The Turns in a reading, broken where the feed itself breaks.
    ///
    /// Two boundaries and no others: a prompt opens a Turn, and a stop-reason row closes one. So a
    /// stretch with no prompt at all is still a Turn, and a stop-reason row belongs to the Turn it
    /// ended rather than to the one after it — which is what makes the lane's blocks and the feed's
    /// punctuation agree row for row.
    static func extents(of rows: [MinimapRow]) -> [MinimapTurn] {
        var turns: [MinimapTurn] = []
        var head = 0
        for (index, row) in rows.enumerated() {
            // A prompt after the head opens the next Turn, so what came before it is closed here.
            if row.prompt != nil, index > head {
                turns.append(turn(of: rows, head ... index - 1))
                head = index
            }
            if row.endsTurn {
                turns.append(turn(of: rows, head ... index))
                head = index + 1
            }
        }
        if head < rows.count {
            turns.append(turn(of: rows, head ... rows.count - 1))
        }
        return turns
    }

    private static func turn(of rows: [MinimapRow], _ extent: ClosedRange<Int>) -> MinimapTurn {
        MinimapTurn(rows: extent, prompt: rows[extent.lowerBound].prompt)
    }
}
