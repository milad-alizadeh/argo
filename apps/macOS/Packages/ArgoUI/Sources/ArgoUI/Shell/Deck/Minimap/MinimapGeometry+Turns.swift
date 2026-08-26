import Foundation

// Where each Turn stands in the miniature (#382). Derived from the same rows and the same prefix
// sums the rects are, so a block can never span a stretch the rects put somewhere else.
//
// Everything here is a binary search into `turns`, never a walk over them. A pointer moving across
// the lane asks this on every event, and a session has as many Turns as it has prompts.

extension MinimapGeometry {
    /// The blocks any part of which reaches into a band of the miniature — what the lane marks when
    /// the reader asks for every Turn at once.
    func blocks(in band: ClosedRange<CGFloat>) -> [MinimapBlock] {
        guard !turns.isEmpty, scale > 0 else { return [] }
        let head = turn(holding: row(startingAtOrBefore: documentY(atMiniatureY: band.lowerBound)))
        let foot = turn(holding: row(startingAtOrBefore: documentY(atMiniatureY: band.upperBound)))
        return (head ... max(head, foot)).map { block(of: turns[$0]) }
    }

    /// The Turn a place in the miniature falls in. `nil` past the end of the reading, where the
    /// pointer is over the lane rather than over any of it.
    func block(atMiniatureY miniatureY: CGFloat) -> MinimapBlock? {
        guard !turns.isEmpty, scale > 0 else { return nil }
        let found =
            block(
                of: turns[
                    turn(holding: row(startingAtOrBefore: documentY(atMiniatureY: miniatureY))),
                ],
            )
        return found.range.contains(miniatureY) ? found : nil
    }

    /// Where a place in the miniature falls in the reading.
    private func documentY(atMiniatureY miniatureY: CGFloat) -> CGFloat {
        miniatureY / scale - reading.topInset
    }

    /// The Turn holding a row, by binary search — the extents are in reading order and do not
    /// overlap, so the last one starting at or before the row is the one it is in.
    private func turn(holding row: Int) -> Int {
        var low = 0
        var high = turns.count - 1
        while low < high {
            let mid = (low + high + 1) / 2
            if turns[mid].rows.lowerBound <= row {
                low = mid
            } else {
                high = mid - 1
            }
        }
        return low
    }

    /// A block runs from its first row's head to where the NEXT row begins, not to where its last
    /// row was DRAWN to. A row held to the line cap is drawn shorter than the reading gave it, and
    /// that difference would be a stripe the lane named no Turn for.
    private func block(of turn: MinimapTurn) -> MinimapBlock {
        let head = rectY(row: turn.rows.lowerBound)
        let foot = rectY(row: turn.rows.upperBound + 1)
        return MinimapBlock(y: head, height: max(0, foot - head), prompt: turn.prompt)
    }
}
