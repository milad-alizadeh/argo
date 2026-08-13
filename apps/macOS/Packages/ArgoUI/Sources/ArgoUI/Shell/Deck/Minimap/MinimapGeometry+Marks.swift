import Foundation

// The rows' own reported shapes at the lane's scale, at their true chronological positions — and
// only for the band of the miniature the lane currently holds as pixels, which is what bounds the
// cost of this to the lane's height rather than to the session's length.
//
// The lane has no arithmetic of its own left. It scales what the rows report and it drops what will
// not resolve; it counts no lines and divides no characters, which is why it can no longer disagree
// with the reading about a row's shape.

extension MinimapGeometry {
    /// Where a row starts in the reading.
    func documentY(row: Int) -> CGFloat {
        guard starts.indices.contains(row) else { return 0 }
        return starts[row]
    }

    /// Where a row's block sits in the miniature, counted down from its head.
    func markY(row: Int) -> CGFloat {
        (reading.topInset + documentY(row: row)) * scale
    }

    /// How tall one line of the reading is drawn, never below what a reader can see. The lane's own
    /// grain: what a claim about "within a line of it" means, and how far past a band's head a row
    /// may still reach into it.
    var lineInLane: CGFloat {
        max(
            ArgoMinimapLane.markMinimumHeight + ArgoMinimapLane.markGap,
            ArgoFeedRow.lineHeight * scale,
        )
    }

    /// What a row's words are actually drawn across: the column less the gutter every row is inset
    /// from it. The lane's drawable stands for exactly this, which is why a full line of it is a
    /// full bar rather than a bar with the gutter drawn in.
    var proseMeasure: CGFloat {
        max(0, reading.columnWidth - ArgoFeedRow.inset * 2)
    }

    /// The marks inside a band of the miniature. Both ends are found by binary search over the
    /// prefix sums, so the cost is the band's own row count rather than the session's.
    ///
    /// The low end is widened by one line: the floor under a mark can draw a short row's block a
    /// touch past its own extent, so a row ending just above the band can still reach it.
    @MainActor func marks(in band: ClosedRange<CGFloat>) -> [MinimapMark] {
        guard scale > 0, !reading.rows.isEmpty else { return [] }
        let head = (band.lowerBound - lineInLane) / scale - reading.topInset
        let foot = band.upperBound / scale - reading.topInset
        return (row(startingAtOrBefore: head) ... row(startingAtOrBefore: foot)).flatMap(marks(at:))
    }

    /// One row's reported marks, scaled into the lane.
    ///
    /// Two things happen to them here and nothing else does. They are held inside the row's own
    /// measured extent, so a row that reports more than the feed drew — a prompt the reader has
    /// folded — cannot spill into the row below it. And a mark the scale has squeezed under the
    /// floor is dropped where its neighbour already covers it, so a compressed paragraph reads as
    /// texture rather than as one smear of overdrawn ink.
    @MainActor private func marks(at at: Int) -> [MinimapMark] {
        let row = reading.rows[at]
        // What the row's CONTENT gets, which is its cell less the step drawn above it.
        let extent = max(0, row.height - row.topStep)
        let top = markY(row: at) + row.topStep * scale
        let measure = proseMeasure
        guard measure > 0 else { return [] }
        var lastY = -CGFloat.greatestFiniteMagnitude
        var marks: [MinimapMark] = []
        for mark in row.shape.marks(across: measure, height: extent) {
            guard marks.isEmpty || fits(mark, inside: extent) else { continue }
            let y = top + mark.y * scale
            let isCrowded = y - lastY < ArgoMinimapLane.markMinimumHeight
                + ArgoMinimapLane.markGap
            if isCrowded, mark.drawn == .bar {
                continue
            }
            lastY = y
            marks.append(scaled(mark, at: y, inside: extent, across: measure))
        }
        return marks
    }

    /// Whether the feed really drew this rectangle. A row reports what its words WOULD make, and
    /// the row may be measured shorter — a prompt the reader has folded is the case that matters.
    /// The first mark is always kept, because a row too compressed to hold even one line still has
    /// to stand for itself.
    ///
    /// The point of slack is the row height's own rounding: the table ceils every height to a whole
    /// point, so a run of lines can end a fraction past what it was measured at.
    private func fits(_ mark: MinimapRowMark, inside extent: CGFloat) -> Bool {
        mark.y + mark.height <= extent + 1
    }

    /// One reported rectangle in the lane's own terms: points of reading become points of lane, and
    /// points across the drawable become shares of it.
    private func scaled(
        _ mark: MinimapRowMark,
        at y: CGFloat,
        inside extent: CGFloat,
        across measure: CGFloat,
    )
        -> MinimapMark {
        // A rule keeps the floor whatever the row is worth: the punctuation between Turns is a
        // hairline in the feed and stays one here.
        let height = mark.drawn == .rule
            ? ArgoMinimapLane.markMinimumHeight
            : max(
                ArgoMinimapLane.markMinimumHeight,
                min(mark.height, extent - mark.y) * scale,
            )
        return MinimapMark(
            y: y,
            height: height,
            span: MinimapMark.span(mark.from / measure, mark.to / measure),
            ink: mark.ink,
            shape: mark.drawn,
        )
    }

    /// The last row starting at or before `documentY`, clamped to the rows there are.
    func row(startingAtOrBefore documentY: CGFloat) -> Int {
        var low = 0
        var high = reading.rows.count - 1
        while low < high {
            let mid = (low + high + 1) / 2
            if starts[mid] <= documentY {
                low = mid
            } else {
                high = mid - 1
            }
        }
        return low
    }
}
