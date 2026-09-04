import Foundation

/// The overview lane's arithmetic: the reading drawn as a proportionate miniature, and a place on
/// the lane mapped back onto the scroll.
///
/// The miniature FITS the lane wherever the session can be drawn at all: the scale is the tightest
/// of the widths' ratio and what the lane's own height would hold, so the whole session is mapped
/// at once and the lit rectangle walks the lane end to end (#1132). Past the length where the rows
/// would be thinner than the smallest mark the lane can draw, it stands taller than the lane again
/// and shows a window onto itself, everything past that below the fold as the feed's own content is
/// (#658) — see `scale`.
///
/// It holds no scroll offset. Everything here is still, which is what lets the lane freeze one of
/// these for the length of a drag and repaint nothing while the reader scrolls.
struct MinimapGeometry: Equatable {
    /// Where each row starts, the total last — a prefix sum, so a row's position is a lookup
    /// rather than a walk over everything above it.
    let starts: [CGFloat]
    /// The Turns the rows break into, worked out once here rather than per hover — the boundaries
    /// are a property of the reading, and the reading is what this holds still.
    let turns: [MinimapTurn]
    package let reading: MinimapReading
    let lane: CGSize

    /// The height a quarter of the rows are shorter than — what `rowGrain` is measured against.
    let shortRowHeight: CGFloat
    /// The same quartile over the Turns' own extents, which is what `turnGrain` is measured
    /// against (#1173).
    let shortTurnHeight: CGFloat

    /// Whether the lane has already coarsened for this reading and stays coarsened for it.
    ///
    /// The latch #1173 asks for. A running Session only grows, and a bare comparison against the
    /// grain would flip the lane's whole appearance mid-scroll and possibly back again near the
    /// boundary — so once a reading has crossed, it stays crossed for as long as the lane is
    /// reading it. `MinimapLaneView` is what holds it; a geometry is still.
    let isCoarsened: Bool

    init(_ reading: MinimapReading, lane: CGSize, coarsened: Bool = false) {
        var starts: [CGFloat] = [0]
        starts.reserveCapacity(reading.rows.count + 1)
        var running: CGFloat = 0
        for row in reading.rows {
            running += max(0, row.height)
            starts.append(running)
        }
        let turns = MinimapTurn.extents(of: reading.rows)
        self.starts = starts
        self.turns = turns
        let document = starts.last ?? 0
        self.shortRowHeight = Self.quarterHeight(
            count: reading.rows.count, over: document,
        ) { max(0, reading.rows[$0].height) }
        // A Turn is worth its rows together, so its extents are tens or hundreds of times a row's —
        // which is exactly why the bucket width is taken off the MEAN rather than fixed. A quantum
        // wider than the quartile itself would round the whole lower quarter of the reading into
        // the first bucket and answer nothing.
        self.shortTurnHeight = Self.quarterHeight(count: turns.count, over: document) {
            starts[turns[$0].rows.upperBound + 1] - starts[turns[$0].rows.lowerBound]
        }
        self.isCoarsened = coarsened
        self.reading = reading
        self.lane = CGSize(width: max(0, lane.width), height: max(0, lane.height))
    }

    /// The row height a quarter of the reading is under, by counting rather than by sorting.
    ///
    /// A percentile and not the mean, and that is the whole of what it is for. A transcript is
    /// mostly one-line messages with a long tool output every so often, and the mean is the one
    /// statistic that tail moves freely: over a real 459-row session the mean read 91pt while the
    /// median read 34 and the lower quartile 26, and a grain taken off the mean drew **329 of the
    /// 459 rows** closer together than a mark and a gap — the smear #658 is about, on the ordinary
    /// shape of a transcript. Off the lower quartile it is 20 rows.
    ///
    /// Counted into whole-point buckets, so it stays O(rows) — a geometry is built for every
    /// derivation, and ADR-0028 Rule 2 does not allow a sort there. Heights are ceiled to whole
    /// points by the measure pass, so a bucket is exact up to the cap; everything at or over the
    /// cap shares the last one, which cannot move a LOWER quartile.
    private static func quarterHeight(
        count: Int,
        over document: CGFloat,
        height: (Int) -> CGFloat,
    )
        -> CGFloat {
        guard count > 0 else { return 0 }
        let quantum = Self.quantum(mean: document / CGFloat(count))
        var counts = [Int](repeating: 0, count: Self.tallestBucket + 1)
        for at in 0 ..< count {
            counts[min(Self.tallestBucket, max(0, Int((height(at) / quantum).rounded(.down))))] += 1
        }
        let quarter = max(1, count / 4)
        var seen = 0
        for (bucket, held) in counts.enumerated() {
            seen += held
            if seen >= quarter {
                return CGFloat(bucket) * quantum
            }
        }
        return CGFloat(Self.tallestBucket) * quantum
    }

    /// How wide one bucket stands, for a reading whose marks average `mean` points.
    ///
    /// Off the mean, because the count above is asked about rows one moment and about Turns the
    /// next, and those differ by two orders of magnitude — a width that suited one would put the
    /// other's whole lower quarter in a single bucket. A whole point at the smallest, since a
    /// height is measured in whole points and nothing is told apart below that.
    ///
    /// It rounds the answer DOWN, so a quartile read here is never taller than the true one and the
    /// grain it feeds is never looser than the reading can hold.
    private static func quantum(mean: CGFloat) -> CGFloat {
        max(1, (mean / CGFloat(bucketsBelowTheMean)).rounded(.up))
    }

    /// How finely the count tells apart what is SHORTER than the mean, which is the half a lower
    /// quartile falls in.
    private static let bucketsBelowTheMean = 128

    /// How many buckets the count above tells apart in all — sixteen times the mean, past which a
    /// mark is in the long tail by any reading, and the tail cannot move a lower quartile wherever
    /// it is put.
    private static let tallestBucket = 2048

    /// How tall the rows stand together.
    var documentHeight: CGFloat {
        starts.last ?? 0
    }

    /// Everything the reader can travel over: the rows plus the feed's own gutters.
    var scrollableHeight: CGFloat {
        reading.topInset + documentHeight + reading.bottomInset
    }

    /// How far the reading is compressed into the lane: the tightest of what the lane's width
    /// gives, what its height would need to hold the whole session, and the grain below which the
    /// session stops being drawn at all (#1132).
    ///
    /// The width alone was the ratio before, and at a real session's length it maps a lane the
    /// reader can only see a fourteenth of at once — 57 000pt of reading became a 9 500pt
    /// miniature in an 800pt lane, so the map of the session was itself a thing to scroll. A map
    /// you scroll to read is not a map, and "the lane mimics the feed's structure" is not reachable
    /// at that compression.
    ///
    /// So the lane FITS the session where it can. What stops it fitting always is `grain`: past a
    /// certain length the rows are thinner than the smallest mark the lane can draw, and a lane
    /// that keeps compressing past that draws a session as one grey smear. There the miniature
    /// stands taller than the lane again and slides inside it exactly as it always did (#658) —
    /// which is why none of `laneTravel`, `viewportY` or `offset(forLaneY:)` changes here.
    ///
    /// `grain` is read at whatever granularity the reading is drawn at, which is the whole of
    /// #1173: a session that will not fit a mark a row is asked again a mark a Turn, and eight of
    /// the nine measured transcripts fit that way. See `MinimapGranularity`.
    var scale: CGFloat {
        let column = columnScale
        guard !reading.rows.isEmpty, scrollableHeight > 0, lane.height > 0 else { return column }
        return min(column, max(fitScale, grain))
    }

    /// What the lane's width gives, capped at 1:1 — a lane wider than the column beside it would
    /// magnify rather than compress, and a column not yet laid out has no ratio to give.
    var columnScale: CGFloat {
        guard reading.columnWidth > 0 else { return 1 }
        return min(1, lane.width / reading.columnWidth)
    }

    /// The compression that puts the whole session in the lane and leaves the lit rectangle ending
    /// flush with the lane's foot at the end of the reading.
    ///
    /// Two quotients and not one, because the rectangle has a floor of its own: where the visible
    /// range compresses under `viewportMinimumHeight` the rectangle is drawn taller than it truly
    /// is, and a miniature fitted to the plain quotient would need the rectangle to hang past the
    /// lane's foot to mark the end of the reading. Fitting the TRAVEL into the lane less the floor
    /// is what the rectangle can actually walk.
    var fitScale: CGFloat {
        let travel = scrollableHeight - reading.viewportHeight
        guard travel > 0 else { return columnScale }
        let room = lane.height - ArgoMinimapLane.viewportMinimumHeight
        guard room > 0 else { return lane.height / scrollableHeight }
        let held = room / travel
        let plain = lane.height / scrollableHeight
        return reading.viewportHeight * held >= ArgoMinimapLane.viewportMinimumHeight
            ? plain
            : held
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
