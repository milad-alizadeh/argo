/// Every figure this package's cost suites were RECORDED at, and the bound each gate derives from
/// one (ADR-0028 Rule 7, #953).
///
/// **PROVISIONAL — these are a loaded laptop's figures, not `macos-26`'s (#1024).** ADR-0028's
/// Consequences require re-recording on `macos-26`, in release, BEFORE the seconds-side budgets
/// bind, and that has not happened. Nothing here goes red or green on a second today — every gate
/// in the suite is a count — but the block ADR-0028 names is still up.
///
/// Every entry reads the same way, and an entry that cannot fill the shape does not belong here:
///
///     Recorded: <what> · <machine> · <configuration> · <sampling>
///
/// - **Machine** — two spellings, and no third. `M4 Pro` (12 cores, 48 GB, macOS 26.5.1, Swift
///   6.3.3) is what #953 recorded on. `Apple silicon laptop` is the whole of what is known about a
///   figure that predates this file — including one that said "M4 MacBook Pro", which is probably
///   this machine and was never verified to be. Read one of those as a shape, never as a number.
/// - **Configuration** — `debug` is `-Onone`; `release` is `-O` with `wholemodule`. A count reads
///   the same in both and says `either`.
/// - **Sampling** — `least of N` for warm work, because CPU noise is one-sided (`CostMeasure`).
///   `cold` where a first pass IS the measurement. `exact` for a count that does not vary.
/// - **loaded** — other agents were building while it was taken. An upper bound, nothing better.
///
/// What the optimiser is worth on these paths, and why it is small, is ADR-0028's Consequences.
enum PerfBudgets {
    /// `CockpitPresentationCostTests` — one presentation comparison may not scale with the
    /// transcript it carries.
    ///
    /// Recorded: 0.997–1.002, a pass 1.8 µs inside a 5 000-pass block over 4 Sessions of 5 824
    /// events · Apple silicon laptop · debug · least of 20. Before the fix an equal comparison of
    /// reallocated buffers cost 5.48 ms against 3.9 µs after, and this quotient read about 19.
    /// Rule 7's 3x would allow 3.0; 1.3 is Rule 3's own number and the tighter of the two.
    static let presentationCompareFlat = 1.3

    /// `FeedRowsCompareCostTests` — asking whether the fresh rows are the reading that stands may
    /// not scale with the reading.
    ///
    /// Recorded: 0.99–1.01 at 300 rows against 4 000 · Apple silicon laptop · debug · least of 20
    /// over 20 000-pass blocks. A rewritten last row costs 0.50 µs against 771 µs before the fix,
    /// and a reload decided at the seam 0.29 µs against 1.21 ms. Rule 3's 1.3, as above.
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
    /// Recorded: 107 rows in the band at the head, 109 half a session down, over the 301-row and
    /// 1 204-row readings · M4 Pro · either · exact. Twice is Rule 8's slack on a count, not Rule
    /// 7's on a duration: the two readings differ by 2 rows and a band that had started costing the
    /// session would read 1 204.
    static let bandPositionSlack = 2

    /// `MinimapCostTests` — a repaint of a band already painted comes off the caches, as a fraction
    /// of the first paint rather than as nothing.
    ///
    /// Recorded: 0 Core Text passes of 32 idle, 2 of 32 when `ProseMetrics`' eight-measure drop
    /// lands mid-paint · M4 Pro · either · exact per run, both readings seen. A quarter, which is
    /// 4x the worse reading — Rule 8's slack on a count and deliberately not Rule 7's 3x, because
    /// which of the two readings a run gets is decided by test ordering rather than by the lane. A
    /// repaint that had stopped coming off the caches costs all 32.
    static let repaintOffCachesFraction = 4

    /// `MinimapCostTests` — a seam drag re-measures the band and not the session, so a session four
    /// times as long costs the same burst.
    ///
    /// Recorded: 841 Core Text passes over the 301-row session, 840 over the 1 204-row one ·
    /// M4 Pro · either · exact. Twice rather than equality because the frames change the scale, so
    /// the band's last row is a boundary the two sessions can fall either side of; a drag paying
    /// for the session would cost 4x.
    static let seamOverSessionSlack = 2

    /// `MinimapCostTests` — a session of nothing but long markdown still pays only for the band. A
    /// heading and a paragraph a row, so a row is worth more than one pass.
    ///
    /// Recorded: 66 Core Text passes over 34 band rows — 1.9 a row — and the repaint 0 of those 66
    /// · M4 Pro · either · exact. 3 gated, which is Rule 8's slack on a count.
    static let markdownPassesPerRow = 3

    /// `MinimapWalkCostTests` — thirty frames of a width burst re-measure less than one document.
    ///
    /// Recorded: 1 420 ruler measures over the 1 000-row reading, against 29 000 before the fix —
    /// one document a frame · Apple silicon laptop · debug · exact, idle and loaded. Three
    /// documents is
    /// 2.1x the reading. The same run's seconds, 13.7 s → 0.9 s of thread CPU, gate nothing: its
    /// two halves are unlike work, which is the CPU quotient that suite rejects.
    ///
    /// Its other counts stay in that suite's header, with `FeedTypesetCostTests`' µs: no constant
    /// reads them, and an unread constant here would be debt rather than a record.
    static let walkBurstDocuments = 3

    /// `ProseTextSizeCostTests` — what #1027's freshness check costs the warm ask it guards.
    ///
    /// Recorded: 0.115–0.117 — 89 ns of clock read against a 762 ns warm ask · M4 Pro · debug ·
    /// least of 9 interleaved, over 100 000-pass blocks. Rule 7's 3x on the recorded figure, and it
    /// has room to spare for what it is there to catch: a check that went back to asking
    /// `NSFont.preferredFont` every ask reads 4.21 µs against the same 762 ns, or 5.6 — a multiple
    /// of the ask rather than a fraction of it, and 16x this bound.
    static let textSizeCheckShare = 0.117 * 3

    /// `ProseTextSizeCostTests` — what the design this was chosen over would have cost: a resolved
    /// size in every cache key, which is an `NSFont.preferredFont` read per key construction.
    ///
    /// Recorded: 5.55–5.59x — a warm ask 753 ns against 4.21 µs with the size read in front of it ·
    /// M4 Pro · debug · least of 9 interleaved, over 20 000-pass blocks. A third of that gap is
    /// the gate, as `repeatReadingFold` above; never rounded down to fit a red run.
    static let keyedTextSizeFold = 5.55 / 3

    /// The seconds `MinimapFigureRecording` re-records, one entry a figure it prints.
    ///
    /// Recorded: over the 301-row reading · M4 Pro, **loaded**, load average 125–164 on 12 cores ·
    /// both, as the two halves · the least of five interleaved rounds, each figure cold or
    /// least-of-N inside a round as its case describes.
    ///
    /// Interleaved because a box picking up a neighbour drifts over a run: five debug rounds
    /// followed by five release ones read the measure pass as SLOWER optimised, purely because the
    /// load average went from 131 to 215 in between (#998).
    ///
    /// Nothing gates on these — a seconds gate on a shared laptop reads the box (`CostMeasure`).
    /// What they are for is the question no count can answer: what the app that SHIPS costs
    /// (ADR-0028 Consequences, and #998).
    static let feedMeasurePass = Figure(debug: 158.76, release: 154.97)
    /// A warm walk of the whole session, which happens on every reshape. The one path here the
    /// optimiser is worth more than a rounding error on, and ADR-0028 says why.
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

    /// One recorded figure in milliseconds, in each of the two configurations. Both halves, because
    /// the gap is the finding: until #953 every figure in the epic was a `-Onone` number.
    struct Figure {
        let debug: Double
        let release: Double

        /// What the optimiser is worth on this path — the debug figure over the release one.
        var optimiserFold: Double {
            (debug / release * 100).rounded() / 100
        }
    }
}
