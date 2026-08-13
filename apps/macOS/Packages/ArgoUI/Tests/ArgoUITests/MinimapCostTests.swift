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
/// suite fails on a REGRESSION rather than on a busy CI box. What matters is the shape: reading a
/// session is linear in its rows and free of glyph work, and painting a band is bounded by the
/// band.
///
/// Measured on an M-series Mac over the 1,031-row `longRows`, for whoever is watching one of these
/// creep: reading 0.45ms, a band 3.5ms cold and 1.6ms warm, sixty scrolled frames 96ms (1.6ms
/// each), thirty seam frames 71ms (2.4ms each), and a band of nothing but long markdown 4.6ms cold.
/// Every one of them is inside a 120Hz frame, and the budgets below sit well above them.
@MainActor
@Suite("Minimap cost")
struct MinimapCostTests {
    private static let column = CGSize(width: 620, height: 800)
    /// A real session's length. `FeedProjection.longRows` is what `feedAtScale` renders.
    private static let rows = FeedProjection.longRows

    private static func elapsed(_ work: () -> Void) -> Double {
        let started = ContinuousClock.now
        work()
        return Double(ContinuousClock.now.duration(to: started).components.attoseconds) / -1e18
    }

    private static func laidOut() -> (table: FeedTableCoordinator, handle: FeedTableHandle) {
        let handle = FeedTableHandle()
        return (FeedTableFixture.laidOut(rows, in: Self.column, through: handle), handle)
    }

    /// Reading the whole session, which happens on every reshape. It walks every row, so it must
    /// stay clear of glyphs: the markdown parse comes off `ProseReading`'s cache and nothing is
    /// measured until the lane asks for a band.
    @Test
    func `reading a session at length costs no glyph work`() {
        let laid = Self.laidOut()
        // Warm, so what is timed is the walk rather than the first parse of every string.
        _ = laid.table.reading()
        let cost = Self.elapsed { _ = laid.table.reading() }
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
        let cold = Self.elapsed { _ = lane.marks(in: band) }
        let warm = Self.elapsed { _ = lane.marks(in: band) }
        #expect(!lane.marks(in: band).isEmpty)
        // Cold is the Core Text pass; warm comes off the cache and is the repaint the reader feels.
        #expect(cold < 0.2)
        #expect(warm < 0.02)
        // A band twice as far down the session costs the same: nothing above it is touched.
        let below = lane.miniatureHeight / 2 ... lane.miniatureHeight / 2 + Self.column.height
        _ = lane.marks(in: below)
        #expect(Self.elapsed { _ = lane.marks(in: below) } < 0.02)
    }

    /// A scroll inside the held band repaints the same marks over and over. Sixty of them is one
    /// second of reading at frame rate, and it has to come off the caches.
    @Test
    func `a second of scrolling inside one band stays inside a frame budget`() {
        let laid = Self.laidOut()
        guard let reading = laid.table.reading() else {
            Issue.record("the fixture laid out no reading")
            return
        }
        let lane = MinimapGeometry(reading, lane: CGSize(width: 112, height: Self.column.height))
        _ = lane.marks(in: 0 ... Self.column.height)
        let cost = Self.elapsed {
            for frame in 0 ..< 60 {
                _ = lane.marks(in: CGFloat(frame) ... CGFloat(frame) + Self.column.height)
            }
        }
        // 60 frames well inside a second, so no single one of them is near 16ms.
        #expect(cost < 0.3)
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
        let cost = Self.elapsed {
            for frame in 0 ..< 30 {
                reading.columnWidth = 620 - CGFloat(frame)
                let lane = MinimapGeometry(
                    reading,
                    lane: CGSize(width: 112, height: Self.column.height),
                )
                _ = lane.marks(in: 0 ... Self.column.height)
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
        let cold = Self.elapsed { _ = lane.marks(in: band) }
        let warm = Self.elapsed { _ = lane.marks(in: band) }
        #expect(!lane.marks(in: band).isEmpty)
        #expect(cold < 0.2)
        #expect(warm < 0.05)
    }
}
