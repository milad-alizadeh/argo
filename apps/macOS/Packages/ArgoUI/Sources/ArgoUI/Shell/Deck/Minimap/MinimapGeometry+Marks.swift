import Foundation

// The rows' own shapes at the lane's scale, at their true chronological positions — and only for
// the band of the miniature the lane currently holds as pixels, which is what bounds the cost of
// this to the lane's height rather than to the session's length.

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

    /// How tall one line of the reading is drawn. The SAME for every row, everywhere in the lane:
    /// two rows of one line each must read as the same weight, and a row's own padding is spacing
    /// rather than content. What the padding buys is the gap to the next row, which is exactly what
    /// it buys in the feed.
    var lineSlot: CGFloat {
        max(
            ArgoMinimapLane.markMinimumHeight + ArgoMinimapLane.markGap,
            ArgoFeedRow.lineHeight * scale,
        )
    }

    /// How many of a row's lines are actually drawn: the lines it was measured at, held to what its
    /// own space in the lane can hold, and then to the cap D25 puts on one event.
    ///
    /// Both limits take lines off the FOOT of the block and never move its head, so a capped row's
    /// chronological place — and every place after it — stays exactly where the reading put it.
    func drawnLines(row: Int) -> Int {
        guard reading.rows.indices.contains(row) else { return 0 }
        let height = reading.rows[row].height
        return max(1, min(
            MinimapRuns.lines(inside: height),
            Int(height * scale / lineSlot),
            Int(markCeiling / lineSlot),
        ))
    }

    /// How tall a row's block stands, cap and all.
    func markHeight(row: Int) -> CGFloat {
        CGFloat(drawnLines(row: row)) * lineSlot
    }

    /// The marks inside a band of the miniature. Both ends are found by binary search over the
    /// prefix sums, so the cost is the band's own row count rather than the session's.
    ///
    /// The low end is widened by one block ceiling: a row that STARTS above the band can still be
    /// drawn into it, because a block reaching past the visible floor is still partly in view.
    func marks(in band: ClosedRange<CGFloat>) -> [MinimapMark] {
        guard scale > 0, !reading.rows.isEmpty else { return [] }
        let head = band.lowerBound / scale - reading.topInset - markCeiling / scale
        let foot = band.upperBound / scale - reading.topInset
        return (row(startingAtOrBefore: head) ... row(startingAtOrBefore: foot)).flatMap(marks(at:))
    }

    /// A row's runs as drawn rectangles, one line slot apiece.
    private func marks(at row: Int) -> [MinimapMark] {
        let lines = drawnLines(row: row)
        let top = markY(row: row)
        let slot = lineSlot
        return MinimapRuns
            .runs(of: reading.rows[row].shape, over: lines, across: reading.columnWidth)
            .filter { $0.line < lines }
            .map { run in
                MinimapMark(
                    y: top + slot * CGFloat(run.line),
                    height: height(of: run, over: min(run.lines, lines - run.line), inside: slot),
                    span: run.span,
                    ink: run.ink,
                )
            }
    }

    /// How tall one run is drawn. A rule keeps the floor whatever the row is worth: the punctuation
    /// between Turns is a hairline in the feed and stays one here. Everything else gives the gap
    /// back, so a paragraph reads as lines rather than as a solid block.
    private func height(of run: MinimapRun, over lines: Int, inside slot: CGFloat) -> CGFloat {
        switch run.ink.shape {
        case .rule: ArgoMinimapLane.markMinimumHeight
        case .bar, .frame, .band:
            max(
                ArgoMinimapLane.markMinimumHeight,
                CGFloat(max(1, lines)) * slot - ArgoMinimapLane.markGap,
            )
        }
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
