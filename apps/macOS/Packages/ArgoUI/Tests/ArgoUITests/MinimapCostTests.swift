import AppKit
@testable import ArgoUI
import Testing

/// What the overview lane COSTS, counted in the two units the cost is actually made of: a ruler
/// measure, and a Core Text pass.
///
/// The reporting rework moved real Core Text work onto two paths that run often, so both get a
/// budget here. A lane that is correct and drops frames is not a lane anybody wants, and neither
/// half shows up in a screenshot.
///
/// COUNTS, never a seconds literal (ADR-0028 Rule 7, whose Context names this suite): a count is
/// exactly the same idle and loaded, where thread CPU is only approximately so (`cpuSeconds`), and
/// a tighter literal would only be a claim about this laptop.
///
/// The claim survives the change of unit intact, because what those seconds were made of is
/// countable. `FeedTableCoordinator.measurements` is one ruler measure — one full SwiftUI layout
/// pass, the most expensive thing the feed does. `ProseMetrics.typesets` is one Core Text pass, the
/// glyph work, which is what "bounded by the band" was ever a statement about: the lane may pay for
/// the rows inside its band and may not pay for the session.
///
/// Measured on an M-series Mac over the 301-row `longRows`, for whoever is watching one of these
/// creep: the feed's own measure pass 142 ms, reading 0.6 ms, a band 4.0 ms cold and 1.5 ms warm,
/// sixty scrolled frames 93 ms (1.6 ms each), thirty seam frames 69 ms (2.3 ms each), and a band of
/// nothing but long markdown 3.9 ms cold. Every per-frame figure is inside a 120 Hz frame. Recorded
/// figures, gated by nothing.
@MainActor
@Suite("Minimap cost", .serialized)
struct MinimapCostTests {
    private static let column = CGSize(width: 620, height: 800)
    private static let lane = CGSize(width: 112, height: 800)

    /// A session of the projection's own rows, every text made distinct — the stores are static and
    /// shared, so a fixture reusing another's strings would be handed a warm cache and measure
    /// nothing. The tag is what keeps each case's cold pass cold.
    private static func rows(_ count: Int, tag: String) -> [FeedRow] {
        let base = FeedProjection.longRows
        return (0 ..< count).map { at in
            let row = base[at % base.count]
            guard case let .message(text) = row.content else {
                return FeedRow(id: at, content: row.content)
            }
            return FeedRow(id: at, content: .message("\(text) [\(tag)/\(at)]"))
        }
    }

    private static func laid(_ rows: [FeedRow]) -> FeedTableCoordinator {
        ProseReading.holding(rows: rows.count)
        return FeedTableFixture.laidOut(rows, in: column, through: FeedTableHandle())
    }

    /// A lane over a session, and the geometry it holds still.
    ///
    /// `atWidth` is the column the prose wrapped across, and it is what `ProseMetrics` keys its
    /// wrapped store by. Those stores are static and shared with the two thousand other tests in
    /// this process, so a case counting what came OFF one takes a width of its OWN — at the shared
    /// 620 its entries can be evicted mid-case by whatever measured there before it, which is a
    /// fact about the suite and not about the lane. Caught as a 1-in-19 flake in exactly that case.
    private static func geometry(over rows: [FeedRow], atWidth width: CGFloat = column.width)
        throws -> MinimapGeometry {
        var reading = try #require(Self.laid(rows).reading())
        reading.columnWidth = width
        return MinimapGeometry(reading, lane: Self.lane)
    }

    /// The band the lane holds as pixels: its own height, from the head of the miniature.
    private static let band: ClosedRange<CGFloat> = 0 ... Self.lane.height

    /// How many rows a band spans — the exact range `rects(in:)` walks, which is the whole of what
    /// "bounded by the band rather than by the session" claims.
    private static func rowsIn(_ band: ClosedRange<CGFloat>, of geometry: MinimapGeometry) -> Int {
        let head = (band.lowerBound - geometry.lineInLane) / geometry.scale
            - geometry.reading.topInset
        let foot = band.upperBound / geometry.scale - geometry.reading.topInset
        return geometry.row(startingAtOrBefore: foot) - geometry.row(startingAtOrBefore: head) + 1
    }

    /// The feed's own measure pass — one hosting-ruler `sizeThatFits` per row, and the most
    /// expensive thing the feed does (#473). #667 asks that reporting line geometry cost no extra
    /// layout pass, and this is the count that says whether it did: one measure a row, not two. The
    /// seconds this used to assert on (142 ms, against a 4 s literal) said the same thing with a
    /// number that would have survived the second pass being added back.
    @Test
    func `the feed's measure pass costs one ruler measure a row`() {
        let rows = Self.rows(301, tag: "measure")

        #expect(Self.laid(rows).measurements == rows.count)
    }

    /// Reading the whole session, which happens on every reshape. It walks every row, so it must
    /// stay clear of glyphs: the markdown parse comes off `ProseReading`'s cache and nothing is
    /// measured until the lane asks for a band.
    @Test
    func `reading a session at length costs no glyph work`() throws {
        let rows = Self.rows(301, tag: "read")
        let table = Self.laid(rows)
        // Warm, so what is counted is the walk rather than the first parse of every string.
        _ = table.reading()
        let typeset = ProseMetrics.typesets
        let read = ProseReading.structureCost
        let reading = try #require(table.reading())

        #expect(reading.rows.count == rows.count)
        #expect(ProseMetrics.typesets == typeset)
        #expect(ProseReading.structureCost.misses == read.misses)
    }

    /// Painting one band, which happens when the reader scrolls out of the band the lane holds.
    /// This is where the glyphs are measured, and the whole design of it is that the cost is the
    /// BAND's rows rather than the session's.
    ///
    /// Said as a shape, which is what the old `cold < 0.2` could not say: four times the session is
    /// the same band, so it is EXACTLY the same rows walked. And a band far down the miniature is
    /// worth a band, not a position — within a row or two of the head's, because the rows it lands
    /// on are of their own heights. Recorded at 107 rows at the head and 109 half a session down.
    @Test
    func `painting a band is bounded by the band rather than by the session`() throws {
        let short = try Self.geometry(over: Self.rows(301, tag: "band"))
        let long = try Self.geometry(over: Self.rows(1204, tag: "wide"))

        #expect(Self.rowsIn(Self.band, of: long) == Self.rowsIn(Self.band, of: short))
        #expect(Self.rowsIn(Self.band, of: long) < 1204)
        let below = long.miniatureHeight / 2 ... long.miniatureHeight / 2 + Self.lane.height
        #expect(Self.rowsIn(below, of: long) < 2 * Self.rowsIn(Self.band, of: long))
    }

    /// The repaint the reader feels: the second look at a band the lane already painted comes off
    /// the caches. Cold pays for the band's rows and no more.
    ///
    /// A FRACTION of the first paint rather than nothing, and the reason is worth writing down
    /// because it cost a 1-in-20 flake to find. `ProseMetrics` keeps one wrapped store per measure
    /// and holds eight measures at a time, dropping them all when a ninth arrives — and the dict is
    /// static, shared with the two thousand other tests in this process. A row's blocks ask at
    /// several measures, so how many of the eight slots are already taken when this case runs
    /// decides whether the drop lands mid-paint, and the test ordering decides that. Recorded at 0
    /// of 32 idle and 2 of 32 when the drop lands; a quarter is the gate, and a repaint that had
    /// stopped coming off the caches would cost all 32.
    @Test
    func `a band already painted is repainted off the caches`() throws {
        let geometry = try Self.geometry(over: Self.rows(301, tag: "repaint"), atWidth: 617)
        let typeset = ProseMetrics.typesets
        #expect(!geometry.rects(in: Self.band).isEmpty)
        let cold = ProseMetrics.typesets - typeset

        let warm = ProseMetrics.typesets
        _ = geometry.rects(in: Self.band)

        #expect(cold <= Self.rowsIn(Self.band, of: geometry))
        #expect((ProseMetrics.typesets - warm) * 4 <= cold)
    }

    /// A scroll inside the held band repaints the same rects over and over. Sixty of them is one
    /// second of reading at frame rate, and it has to come off the caches — which is what the old
    /// `cost < 60 * frame` was reaching for through a wall of seconds.
    ///
    /// Not zero: the band slides a point a frame, so a row can enter it that was not in it before,
    /// and that row is typeset once. So the gate is the FIRST paint — one second of scrolling
    /// inside a band costs no more glyph work than painting that band once did, where a scroll that
    /// had fallen off the caches would cost sixty of them. Recorded at 1 against a first paint of
    /// 32, and it also absorbs the eight-measure drop the repaint case above describes.
    @Test
    func `a second of scrolling inside one band comes off the caches`() throws {
        let geometry = try Self.geometry(over: Self.rows(301, tag: "scroll"), atWidth: 611)
        let first = ProseMetrics.typesets
        _ = geometry.rects(in: Self.band)
        let cold = ProseMetrics.typesets - first
        let typeset = ProseMetrics.typesets

        for at in 0 ..< 60 {
            _ = geometry.rects(in: CGFloat(at) ... CGFloat(at) + Self.column.height)
        }

        #expect(cold > 0)
        #expect(ProseMetrics.typesets - typeset <= cold)
    }

    /// The seam under the reader's finger, which is the worst case the design has: the column moves
    /// every frame, so every wrapped answer is a fresh measure and `ProseMetrics` drops its wrapped
    /// store each time it holds more measures than it keeps. It is also the case the old
    /// character-count arithmetic paid nothing for, so it earns its own gate.
    ///
    /// The cliff the old `cost < 1.5` was watching for is a drag that re-measures the SESSION per
    /// frame instead of the band. Two counts say it did not: the whole burst costs less than the
    /// band's rows once a frame, and — the half no bound on the short session could see — a session
    /// four times as long costs the same burst. Recorded at 841 passes over the 301-row session and
    /// 840 over the 1 204-row one, where a drag paying for the session would cost 4x. The bound is
    /// 2x rather than equality because the frames change the scale, so the last row of the band is
    /// a boundary the two sessions can fall either side of.
    @Test
    func `dragging the seam re-measures the band and not the session`() throws {
        let short = try Self.dragged(over: Self.rows(301, tag: "seam"))
        let long = try Self.dragged(over: Self.rows(1204, tag: "seamwide"))

        #expect(short.typesets < Self.frames * short.rows)
        #expect(long.typesets < 2 * short.typesets)
    }

    /// How many frames of a seam drag one burst is.
    private static let frames = 30
    /// The width the drag starts from — this case's own, for the reason `geometry(over:atWidth:)`
    /// states.
    private static let dragFrom: CGFloat = 700

    /// One seam let go over a session, and the glyph work the lane paid for the burst.
    private static func dragged(over rows: [FeedRow]) throws -> (typesets: Int, rows: Int) {
        var reading = try #require(Self.laid(rows).reading())
        reading.columnWidth = Self.dragFrom
        let held = MinimapGeometry(reading, lane: Self.lane)
        let typeset = ProseMetrics.typesets
        for at in 0 ..< Self.frames {
            reading.columnWidth = Self.dragFrom - CGFloat(at)
            _ = MinimapGeometry(reading, lane: Self.lane).rects(in: Self.band)
        }
        return (ProseMetrics.typesets - typeset, Self.rowsIn(Self.band, of: held))
    }

    /// The worst reading the design has: every row a long markdown message, so every row in the
    /// band is a fresh Core Text pass rather than one cached width. A session of calls pays almost
    /// nothing here, and this is the reading that says what the ceiling actually is — in passes,
    /// which is what the 3.9 ms it used to assert on was made of.
    @Test
    func `a session of nothing but long markdown pays only for the band`() throws {
        let heavy = (0 ..< 300).map { at in
            FeedRow(id: at, content: .message("## Turn \(at)\n\n\(MinimapText.paragraph) [\(at)]"))
        }
        let geometry = try Self.geometry(over: heavy, atWidth: 613)
        let typeset = ProseMetrics.typesets
        #expect(!geometry.rects(in: Self.band).isEmpty)
        let cold = ProseMetrics.typesets - typeset

        let warm = ProseMetrics.typesets
        _ = geometry.rects(in: Self.band)

        // A heading and a paragraph a row, so a row is worth more than one pass — and still it is
        // the band's rows it is worth, not the session's. Recorded at 66 over 34 band rows, and the
        // repaint at 0 of those 66 — a quarter for the reason the repaint case above sets out.
        #expect(cold <= 3 * Self.rowsIn(Self.band, of: geometry))
        #expect((ProseMetrics.typesets - warm) * 4 <= cold)
    }
}
