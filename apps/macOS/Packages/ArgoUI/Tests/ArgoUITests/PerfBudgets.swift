/// Every figure this package's cost suites were RECORDED at, and the bound each gate derives from
/// one (ADR-0028 Rule 7, #953).
///
/// ONE FILE, because a figure kept beside the assertion it justifies is a figure nobody re-reads.
/// `MinimapCostTests` recorded 142 ms in its own header and asserted `cost < 4` — 28x looser than
/// the thing it measured, and green through a twentyfold regression in the path it was written to
/// hold. Gathered here, a bound that has drifted from its figure is visible by looking, and so is a
/// figure with no bound.
///
/// Every entry carries the same provenance, because a figure without it is a number:
///
///     Recorded: <what> · <machine> · <configuration> · <sampling>
///
/// **Machines.** `M4 Pro` is Apple M4 Pro, 12 cores, 48 GB, macOS 26.5.1, Swift 6.3.3.
/// `Apple silicon laptop` is the whole of what is known about a figure taken before this file
/// existed — read one of those as a shape and never as a number.
///
/// **Configurations.** `debug` is `-Onone`. `release` is `-O` with `wholemodule`, which is what
/// `ARGO_TEST_CONFIGURATION=release` builds (#991) and what the app itself is built with (#998).
/// A COUNT reads the same in both, which is most of this suite; a seconds figure does not, and
/// every one below says which configuration it came from.
///
/// **Sampling.** `least of N` for warm work, because CPU noise is one-sided and a minimum
/// converges on the intrinsic cost from above (`CostMeasure`). `cold` for a first pass over an
/// empty store, which IS the measurement and cannot honestly be repeated.
///
/// **A loaded box.** Where an entry says `loaded`, other agents were building on the machine while
/// it was taken — load average in the low hundreds on a 12-core box. Such a figure is an upper
/// bound on that machine and nothing better, which is exactly why nothing here gates on seconds.
///
/// Two files rather than one, and for `CostMeasure`'s reason: `ArgoEngine` and `ArgoUI` are
/// separate packages with no test target between them, and sharing would mean a third package
/// existing so that a list of numbers could be imported twice.
enum PerfBudgets {
    /// `CockpitPresentationCostTests` — one presentation comparison may not scale with the
    /// transcript it carries.
    ///
    /// Recorded: 0.997–1.002 over three readings, a pass 1.8 µs inside a 5 000-pass block, over 4
    /// Sessions of 5 824 events · Apple silicon laptop · debug · least of 20. Before the fix an
    /// equal comparison of reallocated buffers cost 5.48 ms against 3.9 µs after, and this quotient
    /// read about 19.
    static let presentationCompareFlat = 1.3

    /// `FeedRowsCompareCostTests` — asking whether the fresh rows are the reading that stands may
    /// not scale with the reading.
    ///
    /// Recorded: at 4 000 rows a rewritten last row costs 0.50 µs against 771 µs before, and a
    /// reload decided at the seam 0.29 µs against 1.21 ms · Apple silicon laptop · debug · least of
    /// 20 over 20 000-pass blocks.
    static let rowsCompareFlat = 1.3

    /// `SessionsRoomReadingCostTests` — how much cheaper a repeat reading at the same stamp is than
    /// the cold one, with Rule 7's 3x spent on it.
    ///
    /// Recorded: 480x — a cold reading 3.38 ms of thread CPU against 7.0 µs for the repeat, over
    /// the 400-event `longTranscript` · Apple silicon laptop · debug · least of 20 over 100-pass
    /// blocks. A third of the recorded gap is the gate; never rounded down to fit a red run.
    static let repeatReadingFold = 480.0 / 3

    /// `SessionsRoomReadingCostTests` — the same for a second reader of the same scoped rows.
    ///
    /// Recorded: 4 000x — a cold scoped reading 3.04 ms against 0.75 µs for the second reader ·
    /// Apple silicon laptop · debug · least of 20 over 100-pass blocks.
    static let scopedReadingFold = 4000.0 / 3

    /// `MinimapCostTests` — a band far down the miniature is worth a BAND and not a position. Not
    /// equality, because the rows it lands on are of their own heights.
    ///
    /// Recorded: 107 rows in the band at the head and 109 half a session down, over the 301-row and
    /// 1 204-row readings · M4 Pro · a count, so configuration-free.
    static let bandPositionSlack = 2

    /// `MinimapCostTests` — a repaint of a band already painted comes off the caches, as a fraction
    /// of the first paint rather than as nothing.
    ///
    /// Recorded: 0 Core Text passes of 32 idle, and 2 of 32 when `ProseMetrics`' eight-measure drop
    /// lands mid-paint — which the suite's own comment explains and which cost a 1-in-20 flake to
    /// find · M4 Pro · a count. A quarter is the gate; a repaint that had stopped coming off the
    /// caches would cost all 32.
    static let repaintOffCachesFraction = 4

    /// `MinimapCostTests` — a seam drag re-measures the band and not the session, so a session four
    /// times as long costs the same burst.
    ///
    /// Recorded: 841 Core Text passes over the 301-row session and 840 over the 1 204-row one ·
    /// M4 Pro · a count. Twice rather than equality because the frames change the scale, so the
    /// band's last row is a boundary the two sessions can fall either side of; a drag paying for
    /// the session would cost 4x.
    static let seamOverSessionSlack = 2

    /// `MinimapCostTests` — a session of nothing but long markdown still pays only for the band. A
    /// heading and a paragraph a row, so a row is worth more than one pass.
    ///
    /// Recorded: 66 Core Text passes over 34 band rows, and the repaint 0 of those 66 · M4 Pro · a
    /// count. 1.9 passes a row measured, 3 gated.
    static let markdownPassesPerRow = 3

    /// `MinimapWalkCostTests` — thirty frames of a width burst re-measure less than one document.
    ///
    /// Recorded: 1 420 ruler measures over the 1 000-row reading, against 29 000 before the fix —
    /// one document per frame · M-series Mac · debug · a count, exact idle and loaded. Three
    /// documents is 2.1x the reading (Rule 7). The seconds from that run are a figure and gate
    /// nothing: 13.7 s → 0.9 s of thread CPU, and the CPU quotient the suite's own comment rejects.
    static let walkBurstDocuments = 3

    /// The seconds `MinimapFigureRecording` re-records, one entry a figure it prints.
    ///
    /// Recorded: over the 301-row reading · M4 Pro (12 cores, 48 GB, macOS 26.5.1, Swift 6.3.3) ·
    /// both configurations · each figure the LEAST of five rounds, cold or least-of-N inside a
    /// round as its own case describes.
    ///
    /// **The machine was LOADED** — other agents building throughout, load average 125 to 164 on
    /// 12 cores. Every millisecond below is therefore an upper bound on this machine and a quiet
    /// one reads lower. The two configurations were measured **interleaved**, debug then release,
    /// round by round, because a box picking up a neighbour drifts over a run: three debug passes
    /// followed by three release ones read the measure pass as SLOWER optimised, purely because
    /// the load average had gone from 131 to 215 in between (#998). Interleaved, the drift is in
    /// both minima.
    ///
    /// Nothing gates on these. A seconds gate on a shared laptop reads the box (`CostMeasure`) and
    /// every gate in this suite is a count; what these are for is the question no count can answer
    /// — what the app that SHIPS costs, and so whether a count is worth paying for at all (#998).
    ///
    /// **What the optimiser is worth here: 1.0x to 1.3x on six of the seven, and 3.7x on the
    /// seventh.** So the whole #963 epic being sized in debug did not inflate its figures by an
    /// order of magnitude — but the exception says why the rule still matters. Six of these paths
    /// are mostly NOT Argo's code: a ruler measure is SwiftUI hosting plus Core Text, a band paint
    /// is Core Text, and framework code is optimised in both configurations, so `-Onone` inflates
    /// only Argo's own share. The seventh, the warm whole-session walk, is almost entirely Argo's
    /// own Swift — every row visited over warm caches, exactly where retain/release traffic and
    /// bounds checks are the whole cost. The next hot path that is pure Swift will read 3x too.
    static let feedMeasurePass = Figure(debug: 158.76, release: 154.97)
    /// A warm walk of the whole session, which happens on every reshape. The one path here where
    /// the optimiser is worth more than a rounding error.
    static let sessionReading = Figure(debug: 1.08, release: 0.29)
    /// One band painted cold — the Core Text pass.
    static let bandPaintCold = Figure(debug: 4.36, release: 3.61)
    /// The same band repainted, which is what the reader feels on a scroll.
    static let bandPaintWarm = Figure(debug: 1.42, release: 1.11)
    /// One second of reading at frame rate inside the band the lane holds.
    static let sixtyScrolledFrames = Figure(debug: 92.89, release: 72.67)
    /// Thirty frames of a seam drag: the worst case the design has.
    static let thirtySeamFrames = Figure(debug: 90.55, release: 76.70)
    /// A band of nothing but long markdown, cold — the ceiling.
    static let markdownBandCold = Figure(debug: 8.46, release: 7.82)

    /// One recorded figure in milliseconds, in each of the two configurations.
    ///
    /// Both halves rather than one, because the gap IS the finding: until #953 every figure in the
    /// epic was a `-Onone` number, and nobody knew what the shipped app costs.
    struct Figure {
        let debug: Double
        let release: Double

        /// What the optimiser is worth on this path — the debug figure over the release one.
        var optimiserFold: Double {
            (debug / release * 100).rounded() / 100
        }
    }
}
