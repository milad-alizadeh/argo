import AppKit
@testable import ArgoUI
import ProseText
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
/// The seconds those counts are made of live in `PerfBudgets`, in both configurations, with the
/// machine beside them — and `MinimapFigureRecording` is what re-records them (#953). Every
/// per-frame figure there is inside a 120 Hz frame. Recorded figures, gated by nothing.
@MainActor
@Suite("Minimap cost", .serialized)
struct MinimapCostTests {
    private typealias Fixture = MinimapCostFixture

    /// Short enough to fit an 800pt lane at this fixture's own grain, and long enough that fitting
    /// it is a claim: a hundred rows of the projection's prose.
    private static let fitting = 100

    /// The longest this fixture stays drawn a mark a ROW, which is where every claim about glyph
    /// work belongs: past about 250 rows the lane runs out of lane at that granularity and draws a
    /// mark a Turn instead, and a Turn's mark is an extent and an ink — no Core Text at all
    /// (#1173). A case counting passes over a coarsened reading would be counting zero.
    private static let rowGrained = 200

    /// How many MARKS a band spans — the exact range `rects(in:)` walks, which is the whole of what
    /// "bounded by the band rather than by the session" claims. Rows or Turns, as the reading is
    /// drawn (#1173).
    private static func marksIn(_ band: ClosedRange<CGFloat>, of geometry: MinimapGeometry) -> Int {
        let rows = Self.rowsIn(band, of: geometry)
        switch geometry.granularity {
        case .rows: return rows.count
        case .turns: return geometry.turn(holding: rows.upperBound)
            - geometry.turn(holding: rows.lowerBound) + 1
        }
    }

    /// The rows a band reaches over, whatever it draws them as.
    private static func rowsIn(
        _ band: ClosedRange<CGFloat>,
        of geometry: MinimapGeometry,
    )
        -> ClosedRange<Int> {
        let head = (band.lowerBound - geometry.lineInLane) / geometry.scale
            - geometry.reading.topInset
        let foot = band.upperBound / geometry.scale - geometry.reading.topInset
        return geometry.row(startingAtOrBefore: head) ... geometry.row(startingAtOrBefore: foot)
    }

    /// The feed's own measure pass — one hosting-ruler `sizeThatFits` per row, and the most
    /// expensive thing the feed does (#473). #667 asks that reporting line geometry cost no extra
    /// layout pass, and this is the count that says whether it did: one measure a row, not two. The
    /// seconds this used to assert on — `PerfBudgets.feedMeasurePass`, against a 4 s literal —
    /// said the same thing with a number that would have survived the second pass being added
    /// back.
    @Test
    func `the feed's measure pass costs one ruler measure a row`() async {
        let rows = Fixture.rows(301, tag: "measure")

        #expect(await Fixture.laid(rows).measurements == rows.count)
    }

    /// Reading the whole session, which happens on every reshape. It walks every row, so it must
    /// stay clear of glyphs: the markdown parse comes off `ProseReading`'s cache and nothing is
    /// measured until the lane asks for a band.
    @Test
    func `reading a session at length costs no glyph work`() async throws {
        let rows = Fixture.rows(301, tag: "read")
        let table = await Fixture.laid(rows)
        // Warm, so what is counted is the walk rather than the first parse of every string.
        _ = table.reading()

        // Counted for THIS caller and not for the process: since ADR-0030 the whole-document
        // measure pass fills the same stores from other threads, so a counter read either side of
        // one walk is counting whatever else was measuring beside it.
        var reading: MinimapReading?
        let typeset = ProseMetrics.typesets { reading = table.reading() }
        let missed = ProseStoreReads.during { _ = table.reading() }

        #expect(try #require(reading).rows.count == rows.count)
        #expect(typeset == 0)
        #expect(missed == 0)
    }

    /// Painting one band, which happens when the reader scrolls out of the band the lane holds.
    /// This is where the glyphs are measured, and the whole design of it is that the cost is the
    /// BAND's rows rather than the session's.
    ///
    /// Said as a shape, which is what the old `cold < 0.2` could not say: four times the session is
    /// the same band, so it is EXACTLY the same rows walked. And a band far down the miniature is
    /// worth a band, not a position — within a row or two of the head's, because the rows it lands
    /// on are of their own heights. The two readings are `PerfBudgets.bandPositionSlack`.
    /// Both lengths are past the lane's grain, which since #1132 is where a band is a band at all:
    /// under it the lane fits the whole session into itself and the band IS the session, bounded
    /// instead by the arithmetic the case below this one states. Since #1173 that grain is the
    /// TURN grain — a session the lane cannot hold a mark a row is drawn a mark a Turn, and these
    /// rows run about six to a Turn, so both arms are the lengths that moved up with it.
    @Test
    func `painting a band is bounded by the band rather than by the session`() async throws {
        let short = try await Fixture.geometry(over: Fixture.rows(2408, tag: "band"))
        let long = try await Fixture.geometry(over: Fixture.rows(9632, tag: "wide"))

        // Within a rounding of each other rather than equal to the mark: past the grain the scale
        // follows the reading's own lower quartile Turn, and four times the same cyclic fixture
        // does not land on exactly the same quartile. A few marks in four hundred is that
        // rounding; four times the session would be four times the band.
        #expect(short.granularity == .turns)
        #expect(long.granularity == .turns)
        let bands = (short: Self.marksIn(Fixture.band, of: short), long: Self.marksIn(
            Fixture.band, of: long,
        ))
        #expect(abs(bands.long - bands.short) <= bands.short / 20, "\(bands)")
        #expect(bands.long < short.turns.count)
        let below = long.miniatureHeight / 2 ... long.miniatureHeight / 2 + Fixture.lane.height
        #expect(Self.marksIn(below, of: long)
            < PerfBudgets.bandPositionSlack * Self.marksIn(Fixture.band, of: long))
    }

    /// And what a coarsened band costs in glyph work, which is the half no count over the rows can
    /// say: nothing at all. A Turn's mark is its rows' extent, its one ink and its share, all of
    /// which the reading already reported, so the whole of #1173's coarse paint is arithmetic
    /// (ADR-0028 Rule 7).
    ///
    /// Both regimes in one case, and that is what makes the zero a gate rather than a fact about
    /// the fixture: the same setup at row grain typesets the band it paints, so a zero here says
    /// the coarsening happened rather than that nothing was left to measure.
    @Test
    func `a band drawn a mark a Turn costs no glyph work, where a mark a row does`() async throws {
        let fine = try await Fixture.geometry(over: Fixture.rows(Self.rowGrained, tag: "fine"))
        let coarse = try await Fixture.geometry(over: Fixture.rows(2408, tag: "coarse"))
        #expect(fine.granularity == .rows)
        #expect(coarse.granularity == .turns)

        var typeset = ProseMetrics.typesets
        #expect(!fine.rects(in: Fixture.band).isEmpty)
        #expect(ProseMetrics.typesets - typeset > 0)

        typeset = ProseMetrics.typesets
        #expect(!coarse.rects(in: Fixture.band).isEmpty)
        #expect(ProseMetrics.typesets - typeset == PerfBudgets.coarsePaintTypesets)
    }

    /// And the OTHER regime, which #1132 added and which has no band to be bounded by: a session
    /// the lane fits into itself is painted whole, every row of it, in one pass.
    ///
    /// What bounds that is the grain, and the bound is worth stating because it is not obvious. The
    /// lane only fits a session while three rows in four still earn a mark and the gap under it, so
    /// the most rows a fitted miniature can hold is the lane's own height over that — 400 for an
    /// 800pt lane, whatever the session's length in points. Past that the grain holds the scale,
    /// the miniature stands taller than the lane, and the band above bounds it again.
    @Test
    func `a session the lane fits is painted whole, and the grain bounds how much that is`(
    ) async throws {
        let fitted = try await Fixture.geometry(over: Fixture.rows(Self.fitting, tag: "fit"))
        #expect(fitted.miniatureHeight <= Fixture.lane.height)

        let mark = ArgoMinimapLane.rectMinimumHeight + ArgoMinimapLane.rectGap
        let ceiling = Int(Fixture.lane.height / mark)
        #expect(fitted.granularity == .rows)
        #expect(Self.marksIn(Fixture.band, of: fitted) == Self.fitting)
        #expect(Self.marksIn(Fixture.band, of: fitted) <= ceiling)

        // The ceiling really is a ceiling, and since #1173 what it bounds is MARKS rather than
        // rows: a session past it stops fitting at that granularity and is drawn at the next one
        // down. So a fitted paint is never worth more marks than this, whatever the session brought
        // — first a session of more ROWS than the lane holds, which coarsens…
        let past = try await Fixture.geometry(over: Fixture.rows(ceiling + 1, tag: "past"))
        #expect(past.granularity == .turns)

        // …and then one of more TURNS than it holds, which is where the lane runs out of lane for
        // good and the miniature stands taller than it again.
        let deep = try await Fixture.geometry(over: Fixture.rows(2408, tag: "deep"))
        #expect(deep.turns.count > ceiling)
        #expect(deep.miniatureHeight > Fixture.lane.height)
    }

    /// The repaint the reader feels: the second look at a band the lane already painted comes off
    /// the caches. Cold pays for the band's rows and no more.
    ///
    /// A FRACTION of the first paint rather than nothing, and the reason is worth writing down
    /// because it cost a 1-in-20 flake to find. `ProseMetrics` keeps one wrapped store per measure
    /// and holds eight measures at a time, dropping them all when a ninth arrives — and the dict is
    /// static, shared with the two thousand other tests in this process. A row's blocks ask at
    /// several measures, so how many of the eight slots are already taken when this case runs
    /// decides whether the drop lands mid-paint, and the test ordering decides that. The readings
    /// and the fraction they buy are `PerfBudgets.repaintOffCachesFraction`.
    @Test
    func `a band already painted is repainted off the caches`() async throws {
        let geometry = try await Fixture.geometry(
            over: Fixture.rows(Self.rowGrained, tag: "repaint"),
            atWidth: 617,
        )
        let typeset = ProseMetrics.typesets
        #expect(!geometry.rects(in: Fixture.band).isEmpty)
        let cold = ProseMetrics.typesets - typeset

        let warm = ProseMetrics.typesets
        _ = geometry.rects(in: Fixture.band)

        #expect(cold <= Self.marksIn(Fixture.band, of: geometry))
        #expect((ProseMetrics.typesets - warm) * PerfBudgets.repaintOffCachesFraction <= cold)
    }

    /// A scroll inside the held band repaints the same rects over and over. Sixty of them is one
    /// second of reading at frame rate, and it has to come off the caches — which is what the old
    /// `cost < 60 * frame` was reaching for through a wall of seconds.
    ///
    /// Not zero: the band slides a point a frame, so a row can enter it that was not in it before,
    /// and that row is typeset once. So the gate is the FIRST paint — one second of scrolling
    /// inside a band costs no more glyph work than painting that band once did, where a scroll that
    /// had fallen off the caches would cost sixty of them. It also absorbs the eight-measure drop
    /// the repaint case above describes; the readings are `PerfBudgets.repaintOffCachesFraction`.
    @Test
    func `a second of scrolling inside one band comes off the caches`() async throws {
        let geometry = try await Fixture.geometry(
            over: Fixture.rows(Self.rowGrained, tag: "scroll"),
            atWidth: 611,
        )
        let first = ProseMetrics.typesets
        _ = geometry.rects(in: Fixture.band)
        let cold = ProseMetrics.typesets - first
        let typeset = ProseMetrics.typesets

        for at in 0 ..< 60 {
            _ = geometry.rects(in: CGFloat(at) ... CGFloat(at) + Fixture.column.height)
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
    /// frame instead of the band. Two counts say it did not, one per regime: at a mark a row the
    /// whole burst costs less than the band's marks once a frame, and at a mark a Turn it costs no
    /// glyph work at all. The readings are `PerfBudgets.coarsePaintTypesets`.
    ///
    /// Twelve times the session on the second arm rather than four, because the length at which
    /// this fixture stops fitting a mark a row moved up with #1173 — a ratio between the two arms
    /// would say nothing now that the longer one is a different regime, so each is bounded on its
    /// own terms.
    @Test
    func `dragging the seam re-measures the band and not the session`() async throws {
        let short = try await Self.dragged(over: Fixture.rows(Self.rowGrained, tag: "seam"))
        let long = try await Self.dragged(over: Fixture.rows(2408, tag: "seamwide"))

        #expect(short.typesets > 0)
        #expect(short.typesets < Self.frames * short.rows)
        #expect(long.typesets == PerfBudgets.coarsePaintTypesets)
    }

    /// How many frames of a seam drag one burst is.
    private static let frames = 30
    /// The width the drag starts from — this case's own, for the reason `geometry(over:atWidth:)`
    /// states.
    private static let dragFrom: CGFloat = 700

    /// One seam let go over a session, and the glyph work the lane paid for the burst.
    private static func dragged(over rows: [FeedRow]) async throws -> (typesets: Int, rows: Int) {
        let laid = await Fixture.laid(rows)
        var reading = try #require(laid.reading())
        reading.columnWidth = Self.dragFrom
        let held = MinimapGeometry(reading, lane: Fixture.lane)
        let typeset = ProseMetrics.typesets
        for at in 0 ..< Self.frames {
            reading.columnWidth = Self.dragFrom - CGFloat(at)
            _ = MinimapGeometry(reading, lane: Fixture.lane).rects(in: Fixture.band)
        }
        return (ProseMetrics.typesets - typeset, Self.marksIn(Fixture.band, of: held))
    }

    /// The worst reading the design has: every row a long markdown message, so every row in the
    /// band is a fresh Core Text pass rather than one cached width. A session of calls pays almost
    /// nothing here, and this is the reading that says what the ceiling actually is — in passes,
    /// which is what the 3.9 ms it used to assert on was made of.
    @Test
    func `a session of nothing but long markdown pays only for the band`() async throws {
        let heavy = (0 ..< 300).map { at in
            FeedRow(id: at, content: .message("## Turn \(at)\n\n\(MinimapText.paragraph) [\(at)]"))
        }
        let geometry = try await Fixture.geometry(over: heavy, atWidth: 613)
        let typeset = ProseMetrics.typesets
        #expect(!geometry.rects(in: Fixture.band).isEmpty)
        let cold = ProseMetrics.typesets - typeset

        let warm = ProseMetrics.typesets
        _ = geometry.rects(in: Fixture.band)

        // A heading and a paragraph a row, so a row is worth more than one pass — and still it is
        // the band's rows it is worth, not the session's. The readings are
        // `PerfBudgets.markdownPassesPerRow`.
        #expect(cold
            <= PerfBudgets.markdownPassesPerRow * Self.marksIn(Fixture.band, of: geometry))

        // And the repaint comes off the caches here as it does above, which since #1132 it only
        // does because the paint HOLDS the wrapped store to what it is about to ask for
        // (`MinimapGeometry.rects(in:)`). The band can be a whole session now, and a row of headed
        // markdown asks for more than one text: left at the store's own literal the cold paint
        // evicted its own head before it reached its foot and every repaint paid every parse
        // again — ADR-0028 Rule 4's named defect, and a 4x loosening of this very line.
        #expect((ProseMetrics.typesets - warm) * PerfBudgets.repaintOffCachesFraction <= cold)
    }
}
