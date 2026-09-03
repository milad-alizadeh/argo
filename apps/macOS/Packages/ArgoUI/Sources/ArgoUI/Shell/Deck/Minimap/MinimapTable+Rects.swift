import Foundation

// A pipe table as the lane draws it: one stroked cell per cell the feed draws, on the very widths
// and heights `MarkdownTableLayout` places the real ones at.
//
// Not an estimate of the grid any more. The lane asks `MarkdownTable` the same two questions the
// layout asks it, so a cell in the map is the same fraction of the table as the cell it stands for.

extension MarkdownTable {
    /// The table's cells as rectangles, and how tall the whole table stands.
    func laid(across measure: CGFloat) -> (rects: [MinimapRowRect], height: CGFloat) {
        let widths = widths(across: measure)
        let heights = heights(on: widths)
        guard !widths.isEmpty else { return ([], 0) }
        var rects: [MinimapRowRect] = []
        var y: CGFloat = 0
        for height in heights {
            var x: CGFloat = 0
            for width in widths {
                rects.append(MinimapRowRect(
                    y: y, height: height, from: x, to: x + width, ink: .table,
                ))
                x += width
            }
            y += height
        }
        return (rects, y)
    }
}
