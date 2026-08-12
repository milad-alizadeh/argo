import Foundation

// One neutral bar per row, at its true chronological position — and only the ones a given band of
// the miniature actually holds, because the lane rasterises a band rather than the whole thing.

extension MinimapGeometry {
    /// Where a row starts in the reading.
    func documentY(row: Int) -> CGFloat {
        guard starts.indices.contains(row) else { return 0 }
        return starts[row]
    }

    /// Where a row's mark sits in the miniature, counted down from its head.
    func markY(row: Int) -> CGFloat {
        (reading.topInset + documentY(row: row)) * scale
    }

    /// The marks inside a band of the miniature. Both ends are found by binary search over the
    /// prefix sums, so the cost is the band's own row count rather than the session's.
    ///
    /// The low end is widened by one mark ceiling: a row that STARTS above the band can still be
    /// drawn into it, because a mark under the visible floor is raised to where it can be seen.
    func marks(in band: ClosedRange<CGFloat>) -> [MinimapMark] {
        guard scale > 0, !reading.rowHeights.isEmpty else { return [] }
        let head = band.lowerBound / scale - reading.topInset - markCeiling / scale
        let foot = band.upperBound / scale - reading.topInset
        return (row(startingAtOrBefore: head) ... row(startingAtOrBefore: foot)).map(mark(at:))
    }

    private func mark(at row: Int) -> MinimapMark {
        MinimapMark(y: markY(row: row), height: markHeight(of: reading.rowHeights[row]))
    }

    /// A row's weight, in proportion to the reading, up to the cap D25 puts on it and never below
    /// what can be seen. The gap comes out of the mark rather than off its position, so a run of
    /// rows reads as events without any of them moving off where it actually is.
    private func markHeight(of rowHeight: CGFloat) -> CGFloat {
        let drawn = rowHeight * scale - ArgoMinimapLane.markGap
        return min(markCeiling, max(ArgoMinimapLane.markMinimumHeight, drawn))
    }

    /// The last row starting at or before `documentY`, clamped to the rows there are.
    private func row(startingAtOrBefore documentY: CGFloat) -> Int {
        var low = 0
        var high = reading.rowHeights.count - 1
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
