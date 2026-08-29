import AppKit
@testable import ArgoUI
import Testing

/// What the overview lane COSTS, now that the rows report measured geometry rather than the lane
/// dividing character counts.
///
/// The reporting rework moved real Core Text work onto two paths that run often, so both get a
/// budget here. A lane that is correct and drops frames is not a lane anybody wants, and neither
/// half shows up in a screenshot.
///
/// The budgets are deliberately loose — an order of magnitude over what the machine does, so the
/// suite fails on a REGRESSION rather than on a busy CI box. Every figure below is the CPU the work
/// SPENT rather than the seconds that passed, so a Mac with three other agents building on it reads
/// the same as an idle one. The cold readings stay single runs: a first pass over a cold cache IS
/// the measurement.
///
/// What matters is the shape: reading a session is linear in its rows and free of glyph work,
/// and painting a band is bounded by the band.
///
/// Measured on an M-series Mac over the 301-row `longRows`, for whoever is watching one of these
/// creep: the feed's own measure pass 142ms, reading 0.6ms, a band 4.0ms cold and 1.5ms warm, sixty
/// scrolled frames 93ms (1.6ms each), thirty seam frames 69ms (2.3ms each), and a band of nothing
/// but long markdown 3.9ms cold. Every per-frame figure is inside a 120Hz frame, and the budgets
/// below sit well above them.
///
/// The measure pass is the one to read against `main`, which #667's AC4 asks for: `main` takes
/// 140-141ms and this branch 134-145ms over three runs each — the same within run-to-run noise, so
/// the lane's reporting costs no extra layout pass.
@MainActor
@Suite("Minimap cost")
struct MinimapCostTests {
    private static let column = CGSize(width: 620, height: 800)
    /// One frame at 60Hz. A budget for work that runs per frame is stated as a multiple of this
    /// rather than as flat seconds, which encode the speed of whoever wrote them.
    private static let frame = 1.0 / 60
    /// A real session's length. `FeedProjection.longRows` is what `feedAtScale` renders.
    private static let rows = FeedProjection.longRows

    private static func laidOut() -> (table: FeedTableCoordinator, handle: FeedTableHandle) {
        let handle = FeedTableHandle()
        return (FeedTableFixture.laidOut(rows, in: Self.column, through: handle), handle)
    }

    /// The feed's own measure pass — one hosting-ruler `sizeThatFits` per row, and the most
    /// expensive thing the feed does (#473). #667 asks that reporting line geometry cost no extra
    /// layout pass, so this is the number that says whether it did: nothing here changed the ruler,
    /// and the lane's geometry comes out of the heights it already produced.
    ///
    /// The one thing in this change that touches it is `MarkdownTableLayout`, which now sizes a
    /// table from `MarkdownTable` instead of asking its cells — fewer subview passes, not more.
    @Test
    func `the feed's measure pass is not made slower by the lane's reporting`() {
        // Warm the prose caches so what is timed is the ruler rather than the first markdown parse.
        _ = Self.laidOut()
        let cost = cpuSeconds { _ = Self.laidOut() }
        #expect(cost < 4)
    }

    /// Reading the whole session, which happens on every reshape. It walks every row, so it must
    /// stay clear of glyphs: the markdown parse comes off `ProseReading`'s cache and nothing is
    /// measured until the lane asks for a band.
    @Test
    func `reading a session at length costs no glyph work`() {
        let laid = Self.laidOut()
        // Warm, so what is timed is the walk rather than the first parse of every string.
        _ = laid.table.reading()
        let cost = cpuSeconds { _ = laid.table.reading() }
        #expect(laid.table.reading()?.rows.count == Self.rows.count)
        #expect(cost < 0.05)
    }

    /// Painting one band, which happens when the reader scrolls out of the band the lane holds.
    /// This is where the glyphs are measured, and the whole design of it is that the cost is the
    /// BAND's rows rather than the session's.
    @Test
    func `painting a band is bounded by the band rather than by the session`() {
        let laid = Self.laidOut()
        guard let reading = laid.table.reading() else {
            Issue.record("the fixture laid out no reading")
            return
        }
        let lane = MinimapGeometry(reading, lane: CGSize(width: 112, height: Self.column.height))
        let band = 0 ... Self.column.height
        let cold = cpuSeconds { _ = lane.rects(in: band) }
        let warm = cpuSeconds { _ = lane.rects(in: band) }
        #expect(!lane.rects(in: band).isEmpty)
        // Cold is the Core Text pass; warm comes off the cache and is the repaint the reader feels.
        #expect(cold < 0.2)
        #expect(warm < 0.02)
        // A band twice as far down the session costs the same: nothing above it is touched.
        let below = lane.miniatureHeight / 2 ... lane.miniatureHeight / 2 + Self.column.height
        _ = lane.rects(in: below)
        #expect(cpuSeconds { _ = lane.rects(in: below) } < 0.02)
    }

    /// A scroll inside the held band repaints the same rects over and over. Sixty of them is one
    /// second of reading at frame rate, and it has to come off the caches.
    @Test
    func `a second of scrolling inside one band stays inside a frame budget`() {
        let laid = Self.laidOut()
        guard let reading = laid.table.reading() else {
            Issue.record("the fixture laid out no reading")
            return
        }
        let lane = MinimapGeometry(reading, lane: CGSize(width: 112, height: Self.column.height))
        _ = lane.rects(in: 0 ... Self.column.height)
        let cost = cpuSeconds {
            for at in 0 ..< 60 {
                _ = lane.rects(in: CGFloat(at) ... CGFloat(at) + Self.column.height)
            }
        }
        // Sixty frames' worth of budget for sixty frames. It bounds the average rather than the
        // worst one, which is all an aggregate can say — and at 1.6ms each the machine has 10x of
        // it spare, so a fail is a repaint that stopped coming off the caches rather than a busy
        // box.
        #expect(cost < 60 * Self.frame)
    }

    /// The seam under the reader's finger, which is the worst case the design has: the column moves
    /// every frame, so every wrapped answer is a fresh measure and the caches turn over. It is also
    /// the case the old character-count arithmetic paid nothing for, so it earns its own budget.
    @Test
    func `dragging the seam re-measures without falling off a cliff`() {
        let laid = Self.laidOut()
        guard var reading = laid.table.reading() else {
            Issue.record("the fixture laid out no reading")
            return
        }
        let cost = cpuSeconds {
            for at in 0 ..< 30 {
                reading.columnWidth = 620 - CGFloat(at)
                let lane = MinimapGeometry(
                    reading,
                    lane: CGSize(width: 112, height: Self.column.height),
                )
                _ = lane.rects(in: 0 ... Self.column.height)
            }
        }
        // Thirty frames of a drag. Each one measures the band's rows afresh, so this is the number
        // to watch if the lane ever feels heavy under a seam.
        #expect(cost < 1.5)
    }

    /// The worst reading the design has: every row a long markdown message, so every row in the
    /// band is a fresh Core Text pass rather than one cached width. A session of calls pays almost
    /// nothing here, and this is the reading that says what the ceiling actually is.
    @Test
    func `a session of nothing but long markdown still paints a band in a frame`() {
        let heavy = (0 ..< 300).map { at in
            FeedRow(id: at, content: .message("## Turn \(at)\n\n" + MinimapText.paragraph))
        }
        let handle = FeedTableHandle()
        let table = FeedTableFixture.laidOut(heavy, in: Self.column, through: handle)
        guard let reading = table.reading() else {
            Issue.record("the fixture laid out no reading")
            return
        }
        let lane = MinimapGeometry(reading, lane: CGSize(width: 112, height: Self.column.height))
        let band = 0 ... Self.column.height
        let cold = cpuSeconds { _ = lane.rects(in: band) }
        let warm = cpuSeconds { _ = lane.rects(in: band) }
        #expect(!lane.rects(in: band).isEmpty)
        #expect(cold < 0.2)
        #expect(warm < 0.05)
    }
}
