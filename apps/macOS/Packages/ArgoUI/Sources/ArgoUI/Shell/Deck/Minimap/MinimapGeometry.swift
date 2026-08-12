import Foundation

/// The overview lane's arithmetic: the reading drawn as a proportionate miniature, and a place on
/// the lane mapped back onto the scroll.
///
/// The miniature is TALLER than the lane at any real session's length, because its scale comes from
/// the widths rather than from what would fit vertically. So the lane shows a window onto it and
/// everything past that is below the fold, exactly as the feed's own content is (#658).
///
/// It holds no scroll offset. Everything here is still, which is what lets the lane freeze one of
/// these for the length of a drag and repaint nothing while the reader scrolls.
struct MinimapGeometry: Equatable {
    /// Where each row starts, the total last — a prefix sum, so a row's position is a lookup
    /// rather than a walk over everything above it.
    let starts: [CGFloat]
    let reading: MinimapReading
    let lane: CGSize

    init(_ reading: MinimapReading, lane: CGSize) {
        var starts: [CGFloat] = [0]
        starts.reserveCapacity(reading.rowHeights.count + 1)
        var running: CGFloat = 0
        for height in reading.rowHeights {
            running += max(0, height)
            starts.append(running)
        }
        self.starts = starts
        self.reading = reading
        self.lane = CGSize(width: max(0, lane.width), height: max(0, lane.height))
    }

    /// How tall the rows stand together.
    var documentHeight: CGFloat {
        starts.last ?? 0
    }

    /// Everything the reader can travel over: the rows plus the feed's own gutters.
    var scrollableHeight: CGFloat {
        reading.topInset + documentHeight + reading.bottomInset
    }

    /// One ratio, applied to BOTH axes — which is what keeps the miniature at the reading's own
    /// aspect ratio, so a row twice as wide as it is tall stays that in the lane.
    ///
    /// Capped at 1:1, because a lane wider than the column beside it would magnify rather than
    /// compress. A column not yet laid out has no ratio to give and answers 1:1 too.
    var scale: CGFloat {
        guard reading.columnWidth > 0 else { return 1 }
        return min(1, lane.width / reading.columnWidth)
    }

    /// The whole miniature's height, the lane's own height notwithstanding.
    var miniatureHeight: CGFloat {
        scrollableHeight * scale
    }

    /// How far the miniature slides inside the lane. Zero for a reading whose miniature already
    /// fits, which is the case the lane shows whole.
    ///
    /// It carries the lit range's own floor: where the floor draws that range taller than it truly
    /// is, the miniature slides the difference further, so the range still ends flush with the
    /// lane's foot at the end of the reading rather than overshooting it.
    var laneTravel: CGFloat {
        let overflow = miniatureHeight - lane.height
        guard overflow > 0 else { return 0 }
        return overflow + viewportHeightInLane - reading.viewportHeight * scale
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

    /// How tall the viewport rectangle is drawn: the visible range at `scale`, never below what a
    /// hand can find and never taller than the lane.
    var viewportHeightInLane: CGFloat {
        let share = reading.viewportHeight * scale
        return min(lane.height, max(ArgoMinimapLane.viewportMinimumHeight, share))
    }

    /// How far down the miniature the lane's window has slid, for a reading sitting at `offset`.
    /// It follows the reading's progress, so the head of the session is off the top of the lane
    /// once the reader is far enough into it.
    func laneOffset(at offset: CGFloat) -> CGFloat {
        laneTravel * progress(at: offset)
    }

    /// The top of the viewport rectangle, in the lane's own space.
    func viewportY(at offset: CGFloat) -> CGFloat {
        let top = (offset + reading.topInset) * scale - laneOffset(at: offset)
        return min(max(0, top), max(0, lane.height - viewportHeightInLane))
    }

    /// The offset that puts a place in the lane at `laneY` — the one mapping click and drag both
    /// go through.
    ///
    /// A point of lane is worth slightly MORE than `1 / scale` points of reading, because the
    /// miniature slides under the hand as the reading moves. Solving for that slide is what makes
    /// the answer self-consistent: the rectangle lands exactly where the hand is.
    func offset(forLaneY laneY: CGFloat) -> CGFloat {
        let range = offsetRange
        // A lane with no room left over the lit range has no travel to solve for, so the fallback
        // is the plain compression. Never zero, so a click always names a place rather than
        // snapping the reading to its head.
        let solved = lanePointsPerReadingPoint
        let landed = laneY / (solved > 0 ? solved : scale) - reading.topInset
        return min(range.upperBound, max(range.lowerBound, landed))
    }

    /// The offset that centres the viewport rectangle on what was clicked. A click names a place
    /// in the reading rather than a place on a slider, and centring is what makes it land there —
    /// while leaving the rectangle exactly where a scrub from the same point would pick it up.
    func offset(centringLaneY laneY: CGFloat) -> CGFloat {
        offset(forLaneY: laneY - viewportHeightInLane / 2)
    }

    /// The tallest one mark may be drawn — D25's weight cap, as a share of the lane.
    var markCeiling: CGFloat {
        lane.height * ArgoMinimapLane.markMaximumShare
    }

    /// A point of reading, in points of lane. `scale` less the miniature's own slide over the same
    /// travel, so it degrades to exactly `scale` for a miniature that fits the lane whole.
    private var lanePointsPerReadingPoint: CGFloat {
        let travel = offsetRange.upperBound - offsetRange.lowerBound
        guard travel > 0 else { return scale }
        return scale - laneTravel / travel
    }

    /// Where the reading sits, as a share of everywhere it could sit.
    private func progress(at offset: CGFloat) -> CGFloat {
        let range = offsetRange
        let travel = range.upperBound - range.lowerBound
        guard travel > 0 else { return 0 }
        return min(1, max(0, (offset - range.lowerBound) / travel))
    }
}
