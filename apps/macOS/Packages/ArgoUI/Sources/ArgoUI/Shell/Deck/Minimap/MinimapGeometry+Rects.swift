import ArgoDesign
import Foundation
import ProseText

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
    func rectY(row: Int) -> CGFloat {
        (reading.topInset + documentY(row: row)) * scale
    }

    /// How tall one line of the reading is drawn, never below what a reader can see. The lane's own
    /// grain: what a claim about "within a line of it" means, and how far past a band's head a row
    /// may still reach into it.
    var lineInLane: CGFloat {
        max(
            ArgoMinimapLane.rectMinimumHeight + ArgoMinimapLane.rectGap,
            ArgoFeedRow.lineHeight * scale,
        )
    }

    /// What a row's words are actually drawn across: the column less the gutter every row is inset
    /// from it. The lane's drawable stands for exactly this, which is why a full line of it is a
    /// full bar rather than a bar with the gutter drawn in.
    var proseMeasure: CGFloat {
        max(0, reading.columnWidth - ArgoFeedRow.inset * 2)
    }

    /// The rects inside a band of the miniature. Both ends are found by binary search over the
    /// prefix sums, so the cost is the band's own row count rather than the session's.
    ///
    /// The low end is widened by one line: the floor under a rect can draw a short row's block a
    /// touch past its own extent, so a row ending just above the band can still reach it.
    @MainActor func rects(in band: ClosedRange<CGFloat>) -> [MinimapRect] {
        guard scale > 0, !reading.rows.isEmpty else { return [] }
        // A session that will not fit a mark a row is drawn a mark a Turn instead (#1173). It is a
        // second source for the marks and not a second lane: everything above this line, and every
        // mapping between the lane and the reading, is the same either way.
        guard granularity == .rows else { return turnRects(in: band) }
        let head = (band.lowerBound - lineInLane) / scale - reading.topInset
        let foot = band.upperBound / scale - reading.topInset
        let rows = row(startingAtOrBefore: head) ... row(startingAtOrBefore: foot)
        // The wrapped store held to what this walk is about to ask it for, before a row of it is
        // read (ADR-0028 Rule 4, #1132). Since the lane fits a session into itself the band can be
        // the whole document, and a row asks for more than one text — so at the store's own literal
        // the walk evicted its own head before it reached its foot and every repaint paid every
        // parse. `textsPerRow` is what a row of headed markdown actually asks for.
        ProseMetrics.holding(texts: rows.count * ArgoMinimapLane.textsPerRow)
        return rows.flatMap(rects(at:))
    }

    /// One row's reported rects, scaled into the lane.
    ///
    /// Two things happen to them here and nothing else does. They are held inside the row's own
    /// measured extent, so a row that reports more than the feed drew — a prompt the reader has
    /// folded — cannot spill into the row below it. And a rect the scale has squeezed under the
    /// floor is dropped where its neighbour already covers it, so a compressed paragraph reads as
    /// texture rather than as one smear of overdrawn ink.
    @MainActor private func rects(at index: Int) -> [MinimapRect] {
        let row = reading.rows[index]
        // What the row's CONTENT gets, which is its cell less the step drawn above it.
        let extent = max(0, row.height - row.topStep)
        let top = rectY(row: index) + row.topStep * scale
        let measure = proseMeasure
        guard measure > 0 else { return [] }
        var lastY = -CGFloat.greatestFiniteMagnitude
        var rects: [MinimapRect] = []
        for rect in row.shape.rects(across: measure, height: extent) {
            guard rects.isEmpty || fits(rect, inside: extent) else { continue }
            let y = top + rect.y * scale
            guard !isCrowded(rect, at: y, under: lastY) else { continue }
            lastY = max(lastY, y)
            rects.append(scaled(rect, at: y, inside: extent, across: measure))
        }
        return rects
    }

    /// Whether the scale has squeezed a bar so close under its neighbour that the two would draw as
    /// one smear. A compressed paragraph then reads as texture rather than as overdrawn ink.
    ///
    /// Only what is STACKED counts. A rect at or above the last one is beside it, not under it — a
    /// list item's marker, a link's accent and every piece of a call's sentence share their line's
    /// own `y`, and a rule that looked at the distance alone dropped all of them.
    private func isCrowded(_ rect: MinimapRowRect, at y: CGFloat, under lastY: CGFloat) -> Bool {
        // A rule is the floor already and has nothing to give up; everything else can be thinned, a
        // table's cells and a card's border included. Stroking those at the floor is the same smear
        // as filling them.
        guard rect.drawn != .rule, y > lastY else { return false }
        return y - lastY < ArgoMinimapLane.rectMinimumHeight + ArgoMinimapLane.rectGap
    }

    /// Whether the feed really drew this rectangle. A row reports what its words WOULD make, and
    /// the row may be measured shorter — a prompt the reader has folded is the case that matters.
    /// The first rect is always kept, because a row too compressed to hold even one line still has
    /// to stand for itself.
    ///
    /// The point of slack is the row height's own rounding: the table ceils every height to a whole
    /// point, so a run of lines can end a fraction past what it was measured at.
    private func fits(_ rect: MinimapRowRect, inside extent: CGFloat) -> Bool {
        rect.y + rect.height <= extent + 1
    }

    /// One reported rectangle in the lane's own terms: points of reading become points of lane, and
    /// points across the drawable become shares of it.
    private func scaled(
        _ rect: MinimapRowRect,
        at y: CGFloat,
        inside extent: CGFloat,
        across measure: CGFloat,
    )
        -> MinimapRect {
        // A rule keeps the floor whatever the row is worth: the punctuation between Turns is a
        // hairline in the feed and stays one here.
        let height = rect.drawn == .rule
            ? ArgoMinimapLane.rectMinimumHeight
            : max(
                ArgoMinimapLane.rectMinimumHeight,
                min(rect.height, extent - rect.y) * scale,
            )
        return MinimapRect(
            y: y,
            height: height,
            span: MinimapRect.span(rect.from / measure, rect.to / measure),
            ink: rect.ink,
            shape: rect.drawn,
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
