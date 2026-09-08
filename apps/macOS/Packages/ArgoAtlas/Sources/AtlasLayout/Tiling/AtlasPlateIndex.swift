import CoreGraphics

/// Which plate lies under a point, without a walk of the whole list (#1598).
///
/// A uniform grid over the ground the plates cover: a plate is filed in every cell its rect
/// overlaps, and a lookup reads the one cell the point falls in. Every file on the map asks this
/// once for the shadow it throws, so the walk it replaces cost files multiplied by folders and
/// allocated an array per file. Measured over 2801 files and 300 plates, two lookups a file: 741 ms
/// walking, 3.8 ms to build this grid instead.
///
/// Built once per city and thrown away with it.
package struct AtlasPlateIndex {
    /// The plate a rectangle lies on: its PLACE in the plan's own list, which is what names the
    /// folder (#1156), and how deep it sits, which is the tone its ground is drawn in.
    ///
    /// Both together, so nothing downstream can paint a decal in one plate's tone and pick it as
    /// another's, and so no index of this grid's escapes to be spent on a list it did not name.
    package struct Ground: Equatable {
        package let place: Int
        package let depth: Int
    }

    /// The plates, in the plan's own order.
    private let plates: [AtlasPlateFrame]

    private let columns: Axis
    private let rows: Axis

    /// Which plates overlap each cell, row major and each cell in the plan's own order.
    private let cells: [[Int]]

    /// Cells to a side, at most. A grid finer than this costs more to build than the walk it
    /// saves: the outermost plate covers every cell of it on its own.
    private static let mostCellsPerSide = 48

    package init(of plates: [AtlasPlateFrame]) {
        // The union of every plate's rect. A point outside it is on no plate at all, so a lookup
        // there can only answer nothing whichever cell it lands in — which is why `Axis` clamps
        // rather than rejecting.
        let ground = plates.reduce(CGRect.null) { $0.union($1.rect) }
        // One cell per plate, spread over both axes: a repository's own folder count is what
        // decides how fine the grid is.
        let side = min(
            Self.mostCellsPerSide,
            max(1, Int(Double(plates.count).squareRoot().rounded(.up))),
        )
        let columns = Axis(origin: ground.minX, span: ground.width, count: side)
        let rows = Axis(origin: ground.minY, span: ground.height, count: side)

        var cells = [[Int]](repeating: [], count: columns.count * rows.count)
        for (index, plate) in plates.enumerated() {
            for row in rows.cells(from: plate.rect.minY, to: plate.rect.maxY) {
                for column in columns.cells(from: plate.rect.minX, to: plate.rect.maxX) {
                    cells[row * columns.count + column].append(index)
                }
            }
        }

        self.plates = plates
        self.columns = columns
        self.rows = rows
        self.cells = cells
    }

    /// Which plate a rectangle lies on: the deepest frame its middle sits in, since a nested
    /// plate's rect sits wholly inside the one it folds into.
    ///
    /// Asked of the DECAL's own rect rather than the file's: a shadow thrown across a plate
    /// boundary lands on the neighbour's ground, and it is the neighbour's ground it is drawn as.
    ///
    /// Nothing where no plate is under it at all, which is a tiling with no folders in it: the
    /// decal then lies on the desktop and names nothing, the same as the desktop does.
    ///
    /// The FIRST of two plates at one depth wins, which is what a walk of the list answered:
    /// `max(by:)` keeps the earlier of two it cannot order.
    package func plate(under rect: CGRect) -> Ground? {
        let middle = CGPoint(x: rect.midX, y: rect.midY)
        let cell = rows.cell(middle.y) * columns.count + columns.cell(middle.x)
        var found: Ground?
        for index in cells[cell] where plates[index].rect.contains(middle) {
            let depth = plates[index].depth
            if let standing = found, standing.depth >= depth {
                continue
            }
            found = Ground(place: index, depth: depth)
        }
        return found
    }

    /// One axis of the grid: where the ground starts, how far it runs, and how many cells it is
    /// cut into.
    private struct Axis {
        let origin: CGFloat
        let span: CGFloat
        let count: Int

        init(origin: CGFloat, span: CGFloat, count: Int) {
            self.origin = origin
            self.span = span
            // An axis with no length is one cell, whatever the plate count asked for.
            self.count = span > 0 ? count : 1
        }

        /// Which cell one coordinate falls in, held inside the grid.
        ///
        /// Clamped in `CGFloat` before it is ever an `Int`: a plan is not written by the tiler
        /// alone, and an infinite or NaN edge would trap the conversion rather than answer.
        func cell(_ value: CGFloat) -> Int {
            guard span > 0, count > 1 else { return 0 }
            let raw = ((value - origin) / (span / CGFloat(count))).rounded(.down)
            guard raw > 0 else { return 0 }
            guard raw < CGFloat(count) else { return count - 1 }
            return Int(raw)
        }

        /// Every cell a run from one coordinate to another overlaps. Over-inclusive at a cell
        /// boundary, which costs a lookup one `contains` and can never lose a plate.
        func cells(from low: CGFloat, to high: CGFloat) -> ClosedRange<Int> {
            let first = cell(low)
            return first ... max(first, cell(high))
        }
    }
}
