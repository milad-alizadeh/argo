import Foundation

// The rows' own shapes at the lane's scale, at their true chronological positions — and only the
// ones a given band of the miniature actually holds, because the lane rasterises a band rather than
// the whole thing.

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

    /// How tall a row's block stands: its weight in proportion to the reading, up to the cap D25
    /// puts on it and never below what can be seen.
    ///
    /// The cap takes height off the block and never off its position, so expanded evidence is drawn
    /// shorter than it is rather than moved — which is what keeps a capped row's chronological
    /// place, and every place after it, exactly where the reading put it.
    func markHeight(row: Int) -> CGFloat {
        guard reading.rows.indices.contains(row) else { return 0 }
        let drawn = reading.rows[row].height * scale
        return min(markCeiling, max(ArgoMinimapLane.markMinimumHeight, drawn))
    }

    /// The marks inside a band of the miniature. Both ends are found by binary search over the
    /// prefix sums, so the cost is the band's own row count rather than the session's.
    ///
    /// The low end is widened by one block ceiling: a row that STARTS above the band can still be
    /// drawn into it, because a block under the visible floor is raised to where it can be seen.
    func marks(in band: ClosedRange<CGFloat>) -> [MinimapMark] {
        guard scale > 0, !reading.rows.isEmpty else { return [] }
        let head = band.lowerBound / scale - reading.topInset - markCeiling / scale
        let foot = band.upperBound / scale - reading.topInset
        return (row(startingAtOrBefore: head) ... row(startingAtOrBefore: foot)).flatMap(marks(at:))
    }

    /// A row's runs as drawn rectangles: the block split into one slot per line, each run put on
    /// its own.
    private func marks(at row: Int) -> [MinimapMark] {
        let source = reading.rows[row]
        let top = markY(row: row)
        let slot = markHeight(row: row) / CGFloat(source.lines)
        return source.runs.map { run in
            MinimapMark(
                y: top + slot * CGFloat(run.line),
                height: height(of: run.ink, inside: slot),
                span: run.span,
                ink: run.ink,
            )
        }
    }

    /// How tall one run is drawn inside its slot. A rule keeps the floor whatever the row is worth
    /// — the punctuation between Turns is a hairline in the feed and stays one here. Everything
    /// else gives the gap back, so a paragraph reads as lines rather than as a solid block.
    private func height(of ink: MinimapInk, inside slot: CGFloat) -> CGFloat {
        switch ink.shape {
        case .rule: ArgoMinimapLane.markMinimumHeight
        case .bar, .frame, .band:
            max(ArgoMinimapLane.markMinimumHeight, slot - ArgoMinimapLane.markGap)
        }
    }

    /// The last row starting at or before `documentY`, clamped to the rows there are.
    private func row(startingAtOrBefore documentY: CGFloat) -> Int {
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
