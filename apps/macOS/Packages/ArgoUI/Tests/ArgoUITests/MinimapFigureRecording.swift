import AppKit
@testable import ArgoUI
import Foundation
import Testing

/// The harness that RE-RECORDS the seconds figures `PerfBudgets` carries, rather than gating on
/// them.
///
/// It asserts nothing. Thread CPU is only approximately load-independent (`CostMeasure`), so a
/// seconds gate on a shared laptop reads the box; the gates in this suite are counts and ratios,
/// and these figures are what says whether a count is worth paying for at all. Off by default so
/// the `macos` job does not pay for a measurement nobody reads:
///
/// ```sh
/// ARGO_RECORD_FIGURES=1 ARGO_TEST_CONFIGURATION=release sh apps/macOS/scripts/swift-test.sh
/// ```
///
/// Run it on a QUIET machine, in both configurations, and copy what it prints into `PerfBudgets`
/// with the machine and configuration beside it (ADR-0028 Rule 7).
@MainActor
@Suite("Minimap figures", .serialized, .enabled(if: ProcessInfo.processInfo
        .environment["ARGO_RECORD_FIGURES"] != nil))
struct MinimapFigureRecording {
    private static let column = CGSize(width: 620, height: 800)
    private static let lane = CGSize(width: 112, height: 800)
    private static let band: ClosedRange<CGFloat> = 0 ... Self.lane.height

    /// Distinct text per fixture, for the reason `MinimapCostTests.rows(_:tag:)` states: the prose
    /// stores are static and shared, so a fixture reusing another's strings measures a warm cache.
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

    private static func geometry(over rows: [FeedRow], atWidth width: CGFloat) throws
        -> MinimapGeometry {
        var reading = try #require(Self.laid(rows).reading())
        reading.columnWidth = width
        return MinimapGeometry(reading, lane: Self.lane)
    }

    /// One figure against what `PerfBudgets` has it recorded at, so a run says whether the file is
    /// still true and not only what the machine did today. `ms` rather than seconds because every
    /// figure here is a fraction of a frame and a seconds column reads as noise.
    private static func record(_ what: String, _ recorded: PerfBudgets.Figure, _ seconds: Double) {
        let now = (seconds * 1e5).rounded() / 100
        print("FIGURE \(what): \(now) ms — recorded \(recorded.debug) debug, "
            + "\(recorded.release) release, \(recorded.optimiserFold)x")
    }

    /// The feed's own measure pass, cold: one hosting-ruler `sizeThatFits` a row over the 301-row
    /// reading, and the most expensive thing the feed does. Single-sample — a first pass over a
    /// cold prose cache IS the measurement.
    @Test
    func `the feed's measure pass, cold`() {
        let rows = Self.rows(301, tag: "figure-measure")
        Self.record(
            "feed measure pass, 301 rows cold",
            PerfBudgets.feedMeasurePass,
            cpuSeconds { _ = Self.laid(rows) },
        )
    }

    /// Reading the whole session warm, which happens on every reshape. Least of N: repeating the
    /// walk is honest, because the walk is what runs on every reshape after the first.
    @Test
    func `reading a session, warm`() {
        let table = Self.laid(Self.rows(301, tag: "figure-read"))
        _ = table.reading()
        Self.record(
            "session reading, 301 rows warm",
            PerfBudgets.sessionReading,
            leastCPUSeconds { _ = table.reading() },
        )
    }

    /// Painting one band cold, then the repaint the reader feels. Cold is single-sample by
    /// definition; the repaint is the least of N.
    @Test
    func `painting a band, cold and warm`() throws {
        let geometry = try Self.geometry(over: Self.rows(301, tag: "figure-band"), atWidth: 619)
        Self.record(
            "band paint, cold",
            PerfBudgets.bandPaintCold,
            cpuSeconds { _ = geometry.rects(in: Self.band) },
        )
        Self.record(
            "band paint, warm",
            PerfBudgets.bandPaintWarm,
            leastCPUSeconds { _ = geometry.rects(in: Self.band) },
        )
    }

    /// One second of reading at frame rate inside the band the lane holds.
    @Test
    func `sixty scrolled frames`() throws {
        let geometry = try Self.geometry(over: Self.rows(301, tag: "figure-scroll"), atWidth: 618)
        _ = geometry.rects(in: Self.band)
        Self.record("sixty scrolled frames", PerfBudgets.sixtyScrolledFrames, leastCPUSeconds {
            for at in 0 ..< 60 {
                _ = geometry.rects(in: CGFloat(at) ... CGFloat(at) + Self.column.height)
            }
        })
    }

    /// Thirty frames of a seam drag: the column moves every frame, so every wrapped answer is a
    /// fresh measure and the wrapped store turns over. The worst case the design has.
    @Test
    func `thirty seam frames`() throws {
        var reading = try #require(Self.laid(Self.rows(301, tag: "figure-seam")).reading())
        Self.record("thirty seam frames", PerfBudgets.thirtySeamFrames, leastCPUSeconds {
            for at in 0 ..< 30 {
                reading.columnWidth = 700 - CGFloat(at)
                _ = MinimapGeometry(reading, lane: Self.lane).rects(in: Self.band)
            }
        })
    }

    /// A session of nothing but long markdown, so every row in the band is a fresh Core Text pass.
    @Test
    func `a band of nothing but long markdown, cold`() throws {
        let heavy = (0 ..< 300).map { at in
            FeedRow(id: at, content: .message("## Turn \(at)\n\n\(MinimapText.paragraph) [f\(at)]"))
        }
        let geometry = try Self.geometry(over: heavy, atWidth: 616)
        Self.record(
            "markdown band paint, cold",
            PerfBudgets.markdownBandCold,
            cpuSeconds { _ = geometry.rects(in: Self.band) },
        )
    }
}
