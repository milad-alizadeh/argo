import Foundation

/// The overview lane's arithmetic: the reading's own positions, compressed into the lane, and a
/// place on the lane mapped back onto the scroll.
///
/// It holds no scroll offset. Everything here is still, which is what lets the lane freeze one of
/// these for the length of a drag and repaint nothing while the reader scrolls.
struct MinimapGeometry: Equatable {
    /// Where each row starts, the total last — a prefix sum, so a row's position is a lookup
    /// rather than a walk over everything above it.
    private let starts: [CGFloat]
    private let reading: MinimapReading
    private let laneHeight: CGFloat

    init(_ reading: MinimapReading, laneHeight: CGFloat) {
        var starts: [CGFloat] = [0]
        starts.reserveCapacity(reading.rowHeights.count + 1)
        var running: CGFloat = 0
        for height in reading.rowHeights {
            running += max(0, height)
            starts.append(running)
        }
        self.starts = starts
        self.reading = reading
        self.laneHeight = max(0, laneHeight)
    }

    /// How tall the rows stand together.
    var documentHeight: CGFloat {
        starts.last ?? 0
    }

    /// Everything the reader can travel over: the rows plus the feed's own gutters.
    var scrollableHeight: CGFloat {
        reading.topInset + documentHeight + reading.bottomInset
    }

    /// How far the lane compresses the reading. Capped at 1:1 — a reading shorter than the lane is
    /// drawn at its own size rather than stretched to fill it, because a two-row Session stretched
    /// to a full lane reads as a long one.
    var scale: CGFloat {
        guard scrollableHeight > 0 else { return 1 }
        return min(1, laneHeight / scrollableHeight)
    }

    /// Where the reading may sit. The floor is the top gutter, which the clip view starts above;
    /// the ceiling is the last row's end plus the bottom gutter, less what is on screen.
    var offsetRange: ClosedRange<CGFloat> {
        let floor = -reading.topInset
        let ceiling = documentHeight + reading.bottomInset - reading.viewportHeight
        return floor ... max(floor, ceiling)
    }

    /// Whether the reading can be moved at all. A reading that fits on screen has no viewport to
    /// mark — the rectangle would cover the whole lane and say nothing, in the loudest colour the
    /// app has.
    var isScrollable: Bool {
        offsetRange.upperBound > offsetRange.lowerBound
    }

    /// How tall the viewport rectangle is drawn: the share of the reading on screen, never below
    /// what a hand can find.
    var viewportHeightInLane: CGFloat {
        let share = reading.viewportHeight * scale
        return min(laneHeight, max(ArgoMinimapLane.viewportMinimumHeight, share))
    }

    /// One neutral bar per row, at its true chronological position.
    var marks: [MinimapMark] {
        let compression = scale
        return reading.rowHeights.indices.map { row in
            MinimapMark(
                y: (reading.topInset + documentY(row: row)) * compression,
                height: markHeight(of: reading.rowHeights[row], at: compression),
            )
        }
    }

    /// Where a row starts in the reading.
    func documentY(row: Int) -> CGFloat {
        guard starts.indices.contains(row) else { return 0 }
        return starts[row]
    }

    /// The top of the viewport rectangle for a reading sitting at `offset`.
    func viewportY(at offset: CGFloat) -> CGFloat {
        viewportTravel * progress(at: offset)
    }

    /// The offset that puts the viewport rectangle's top at `laneY` — the scrub's mapping, and the
    /// reason a scrub is not 1:1: the rectangle travels the lane less its OWN height while the
    /// reading travels everything it has, so a point of lane is worth many points of reading.
    func offset(forViewportY laneY: CGFloat) -> CGFloat {
        let range = offsetRange
        guard viewportTravel > 0 else { return range.lowerBound }
        let share = min(1, max(0, laneY / viewportTravel))
        return range.lowerBound + share * (range.upperBound - range.lowerBound)
    }

    /// The offset that centres the viewport rectangle on what was clicked. A click names a place
    /// in the reading rather than a place on a slider, and centring is what makes it land there —
    /// while leaving the rectangle exactly where a scrub from the same point would pick it up.
    func offset(centringLaneY laneY: CGFloat) -> CGFloat {
        offset(forViewportY: laneY - viewportHeightInLane / 2)
    }

    /// How far the rectangle itself may travel — its own track, which is the lane less its height.
    private var viewportTravel: CGFloat {
        max(0, laneHeight - viewportHeightInLane)
    }

    /// Where the reading sits, as a share of everywhere it could sit.
    private func progress(at offset: CGFloat) -> CGFloat {
        let range = offsetRange
        let travel = range.upperBound - range.lowerBound
        guard travel > 0 else { return 0 }
        return min(1, max(0, (offset - range.lowerBound) / travel))
    }

    /// The tallest one mark may be drawn — D25's weight cap, as a share of the lane.
    var markCeiling: CGFloat {
        laneHeight * ArgoMinimapLane.markMaximumShare
    }

    /// A row's weight, in proportion to the reading, up to the cap D25 puts on it and never below
    /// what can be seen. The gap comes out of the mark rather than off its position, so a run of
    /// rows reads as events without any of them moving off where it actually is.
    private func markHeight(of rowHeight: CGFloat, at scale: CGFloat) -> CGFloat {
        let drawn = rowHeight * scale - ArgoMinimapLane.markGap
        return min(markCeiling, max(ArgoMinimapLane.markMinimumHeight, drawn))
    }
}
