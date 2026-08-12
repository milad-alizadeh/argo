import Foundation

// Where each Turn stands in the miniature (#382). Derived from the same rows and the same prefix
// sums the marks are, so a block can never span a stretch the marks put somewhere else.

extension MinimapGeometry {
    /// Every Turn in the reading, as a block in the miniature.
    var blocks: [MinimapBlock] {
        turns.map(block(of:))
    }

    /// The blocks any part of which reaches into a band of the miniature — what the lane draws a
    /// line beside when it rasterises that band.
    func blocks(in band: ClosedRange<CGFloat>) -> [MinimapBlock] {
        blocks.filter { $0.y <= band.upperBound && $0.y + $0.height >= band.lowerBound }
    }

    /// The Turn a place in the miniature falls in. What a hover names, and `nil` where the pointer
    /// is past the end of the reading rather than over any of it.
    func block(atMiniatureY miniatureY: CGFloat) -> MinimapBlock? {
        blocks.first { $0.range.contains(miniatureY) }
    }

    private func block(of turn: MinimapTurn) -> MinimapBlock {
        let head = markY(row: turn.rows.lowerBound)
        let foot = markY(row: turn.rows.upperBound) + markHeight(row: turn.rows.upperBound)
        return MinimapBlock(y: head, height: max(0, foot - head), prompt: turn.prompt)
    }
}
