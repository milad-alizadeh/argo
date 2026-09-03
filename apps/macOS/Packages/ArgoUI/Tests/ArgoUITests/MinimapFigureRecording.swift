@testable import ArgoUI
import Foundation
import Testing

/// The harness that RE-RECORDS the seconds figures `PerfBudgets` carries, rather than gating on
/// them.
///
/// It asserts nothing. Thread CPU is only approximately load-independent (`CostMeasure`), so a
/// seconds gate on a shared laptop reads the box; the gates in this suite are counts and ratios,
/// and these figures are what says whether a count is worth paying for at all. Off by default so
/// the `macos` job does not pay for a measurement nobody reads.
///
/// One arm of one round is a run of this suite. Both arms, interleaved, least of N, and the
/// completeness check that catches an env-gated suite quietly measuring nothing, are its harness:
///
/// ```sh
/// sh apps/macOS/scripts/record-figures.sh
/// ```
///
/// Run that on a QUIET machine — `macos-26`, which is what ADR-0028's Consequences ask for and
/// what `.github/workflows/figures.yml` is for — and copy what it prints into `PerfBudgets` with
/// the machine beside it, `figureMachine` included (ADR-0028 Rule 7, #1024).
@MainActor
@Suite("Minimap figures", .serialized, .enabled(if: ProcessInfo.processInfo
        .environment["ARGO_RECORD_FIGURES"] != nil))
struct MinimapFigureRecording {
    private typealias Fixture = MinimapCostFixture

    /// One figure against what `PerfBudgets` has it recorded at, so a run says whether the file is
    /// still true and not only what the machine did today. `ms` rather than seconds because every
    /// figure here is a fraction of a frame and a seconds column reads as noise.
    ///
    /// `what` is a slug and not prose, and the line is fields rather than a sentence, because the
    /// harness reads these back: it takes the least of N per arm across two configurations, and a
    /// run where one slug is missing from one arm is a case that failed or was skipped.
    private static func record(_ what: String, _ recorded: PerfBudgets.Figure, _ seconds: Double) {
        let fresh = (seconds * 1e5).rounded() / 100
        // `unbound` and not a number, because a fold of two loaded readings is one (#998). It is
        // what says a seconds-side budget still has nothing to bind to.
        let fold = recorded.optimiserFold.map { "\($0)x" } ?? "unbound"
        print("FIGURE \(what) fresh=\(fresh)ms recorded-debug=\(recorded.debug)ms "
            + "recorded-release=\(recorded.release)ms on=\(PerfBudgets.figureMachine.rawValue) "
            + "fold=\(fold)")
    }

    /// The feed's own measure pass, cold: the whole 301-row document typeset and worked out
    /// before a row of it is drawn, which is the most expensive thing the feed does. Single-sample
    /// — a first pass over a cold prose cache IS the measurement.
    ///
    /// On the wall clock and not the thread's, for `elapsedSeconds`' reason: the pass runs off the
    /// main actor and across cores since ADR-0030, and the calling thread's CPU clock is charged
    /// for none of it.
    @Test
    func `the feed's measure pass, cold`() async {
        let rows = Fixture.rows(301, tag: "figure-measure")
        await Self.record(
            "feed-measure-pass-cold",
            PerfBudgets.feedMeasurePass,
            elapsedSeconds { _ = await Fixture.laid(rows) },
        )
    }

    /// Reading the whole session warm, which happens on every reshape. Least of N: repeating the
    /// walk is honest, because the walk is what runs on every reshape after the first.
    @Test
    func `reading a session, warm`() async {
        let table = await Fixture.laid(Fixture.rows(301, tag: "figure-read"))
        _ = table.reading()
        Self.record(
            "session-reading-warm",
            PerfBudgets.sessionReading,
            leastCPUSeconds { _ = table.reading() },
        )
    }

    /// Painting one band cold, then the repaint the reader feels. Cold is single-sample by
    /// definition; the repaint is the least of N.
    @Test
    func `painting a band, cold and warm`() async throws {
        let geometry = try await Fixture.geometry(
            over: Fixture.rows(301, tag: "figure-band"),
            atWidth: 619,
        )
        Self.record(
            "band-paint-cold",
            PerfBudgets.bandPaintCold,
            cpuSeconds { _ = geometry.rects(in: Fixture.band) },
        )
        Self.record(
            "band-paint-warm",
            PerfBudgets.bandPaintWarm,
            leastCPUSeconds { _ = geometry.rects(in: Fixture.band) },
        )
    }

    /// One second of reading at frame rate inside the band the lane holds.
    @Test
    func `sixty scrolled frames`() async throws {
        let geometry = try await Fixture.geometry(
            over: Fixture.rows(301, tag: "figure-scroll"),
            atWidth: 618,
        )
        _ = geometry.rects(in: Fixture.band)
        Self.record("sixty-scrolled-frames", PerfBudgets.sixtyScrolledFrames, leastCPUSeconds {
            for at in 0 ..< 60 {
                _ = geometry.rects(in: CGFloat(at) ... CGFloat(at) + Fixture.column.height)
            }
        })
    }

    /// Thirty frames of a seam drag: the column moves every frame, so every wrapped answer is a
    /// fresh measure and the wrapped store turns over. The worst case the design has.
    @Test
    func `thirty seam frames`() async throws {
        let laid = await Fixture.laid(Fixture.rows(301, tag: "figure-seam"))
        var reading = try #require(laid.reading())
        Self.record("thirty-seam-frames", PerfBudgets.thirtySeamFrames, leastCPUSeconds {
            for at in 0 ..< 30 {
                reading.columnWidth = 700 - CGFloat(at)
                _ = MinimapGeometry(reading, lane: Fixture.lane).rects(in: Fixture.band)
            }
        })
    }

    /// A session of nothing but long markdown, so every row in the band is a fresh Core Text pass.
    @Test
    func `a band of nothing but long markdown, cold`() async throws {
        let heavy = (0 ..< 300).map { at in
            FeedRow(id: at, content: .message("## Turn \(at)\n\n\(MinimapText.paragraph) [f\(at)]"))
        }
        let geometry = try await Fixture.geometry(over: heavy, atWidth: 616)
        Self.record(
            "markdown-band-cold",
            PerfBudgets.markdownBandCold,
            cpuSeconds { _ = geometry.rects(in: Fixture.band) },
        )
    }
}
