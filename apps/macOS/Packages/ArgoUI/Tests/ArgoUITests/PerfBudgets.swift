/// Every figure this package's cost suites were RECORDED at, and the bound each gate derives from
/// one (ADR-0028 Rule 7, #953).
///
/// **PROVISIONAL — these are a loaded laptop's figures, not `macos-26`'s (#1024).** ADR-0028's
/// Consequences require re-recording on `macos-26`, in release, BEFORE the seconds-side budgets
/// bind, and that has not happened. Nothing here goes red or green on a second today — every gate
/// in the suite is a count — but the block ADR-0028 names is still up. `figureMachine` below is
/// that block as a value rather than as prose: while it says `.loadedLaptop`, no `Figure` offers
/// a fold and nothing downstream can bind to one.
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
    /// `CockpitPresentationCostTests` — one presentation comparison reads NONE of the transcript
    /// it carries, at either transcript length.
    ///
    /// Recorded: 0 reads of `Stream.events` over 4 Sessions of 728 events and of 5 824 · M4 Pro ·
    /// either · exact. A comparison answered by the stamp asks for no events at all; one that
    /// walked them asks once a side per Session — 8 over this fixture — which is why zero is
    /// gated exactly rather than with slack.
    ///
    /// The same claim in seconds rides along here and BINDS nothing (ADR-0028 Rule 8): a quotient
    /// of 0.997–1.002 under a `1.3`, a pass 1.8 µs inside a 5 000-pass block · Apple silicon
    /// laptop · debug · least of 20; before the fix an equal comparison of reallocated buffers
    /// cost 5.48 ms against 3.9 µs after, and that quotient read about 19. It is a figure and not
    /// a bound because its arms are the same comparison over eight times the resident working set,
    /// a difference `CLOCK_THREAD_CPUTIME_ID` charges to the larger arm in every trial — and it
    /// read **1.3045** on the `macos` job on a branch touching nothing it measures, with `main`
    /// green on the same code (#1068).
    static let presentationCompareReads = 0

    /// `SessionSelectionCostTests` — how many streams the pass between the mouse-down and the
    /// frame that paints the selected ground still asks for, at either transcript length.
    ///
    /// Recorded: 3 reads of `Stream.events` over a roster of two running managed Sessions, at 728
    /// events each and at 5 824 · M4 Pro · either · exact. The three are NAMED, because a count
    /// nobody can account for is a budget rather than a finding:
    ///
    /// - two roster-row hand-outs, one per running managed row, each walked twice and bounded by
    ///   the tail both times: `openTurnStartMs` stops at the open Turn's boundary, and
    ///   `activity(of:in:)` at the newest call (#1199). Two walks, one hand-out — which is why
    ///   the row reads `session.events` into a local rather than reaching for it twice;
    /// - one `TouchedFiles.touched`, the composer's `@` picker over the selected Session — the one
    ///   walk left on this pass that is still linear in the transcript, and named here rather than
    ///   cut because the composer is drawn from the pass and cannot be deferred without the deck's
    ///   one slot changing height under the click.
    ///
    /// The reading itself is not among them and cannot be: `the pass that paints a fresh selection
    /// takes no reading` gates that at zero directly, off `SessionsRoomReading.tally`. This number
    /// is the OTHER half — that what is left does not follow the length, which is Rule 3's claim
    /// and why the case carries the two sizes.
    static let selectionPassReads = 3

    /// `FeedRowsCompareCostTests` — asking whether the fresh rows are the reading that stands may
    /// not scale with the reading.
    ///
    /// Recorded: 0.99–1.01 at 300 rows against 4 000 · Apple silicon laptop · debug · least of 20
    /// over 20 000-pass blocks. A rewritten last row costs 0.50 µs against 771 µs before the fix,
    /// and a reload decided at the seam 0.29 µs against 1.21 ms. Rule 3's 1.3, as above.
    static let rowsCompareFlat = 1.3

    /// How many times the converge walk may run for one landing, and for one adopt (#1132).
    ///
    /// Recorded: exactly 1 walk over exactly the document's rows — 200 rows walked once on a mount
    /// and its landing, once again over 212 when the reading grew, once on an adopt · Apple silicon
    /// laptop · debug · exact. Counted rather than timed, and counted at the walk rather than at
    /// the delegate: `show` notes every row before the walk runs and `noteHeightOfRows` asks
    /// eagerly, so by the time `converge` reaches a row AppKit already has its height and the walk
    /// asks the delegate for nothing. A gate on the delegate's asks stayed green with both
    /// `converge` calls deleted.
    ///
    /// The counterfactuals the walk itself was read against, on the 459-row synthetic: `tile()`
    /// alone moved the table's height not at all, `noteHeightOfRows` over every row moved it 938pt
    /// of the 8 663 owed, and setting the frame outright was taken back by the next tile. Walking
    /// only from the first row whose height moved is also not sound — `show` reloads, and a reload
    /// drops the row cache wholesale, which left a twelve-row append 8 819pt short.
    static let convergeWalksPerLanding = 1

    /// `FeedScaleTests` — telling two same-named files apart grows with the record and not with
    /// the square of it.
    ///
    /// Recorded: 754 paths looked at over the long reading's 456 contents · M4 Pro · either ·
    /// exact. A pass that asked every path which others share its name looks at 207 936.
    ///
    /// Gated exactly rather than with slack, because the suite multiplies the same reading and a
    /// fold alone would hold a counter that had stopped seeing the rivalry term — which is the
    /// term carrying the quadratic. A fixture edit moves this number and is meant to.
    ///
    /// The same claim in seconds rides along here and BINDS nothing (ADR-0028 Rule 8): a quotient
    /// of 9.1–9.9 under a bare inline `40`, loaded or idle · Apple silicon laptop · debug · least
    /// of 5. It is a figure and not a bound because its arms are the same pass over ten times the
    /// resident working set, which is a difference `CLOCK_THREAD_CPUTIME_ID` charges to the larger
    /// arm in every trial — 3.98 to 4.10 of it on the same shape in `FeedTypesetCostTests`, and a
    /// bias in every trial is not one a least-of-N can remove.
    static let labellingLooks = 754

    /// `TicketsRoomCostTests` — selecting one ticket may not scale with the ticket set.
    ///
    /// Recorded: 2 Tickets read for a selection over a listing of 200 and over one of 2 000 — the
    /// ticket itself and its one blocker · M4 Pro · either · exact. Before the memo a selection
    /// cost the whole listing: 562 against 5 602, or a ratio of 9.97.
    ///
    /// Rule 3's 1.3, spent on counts that are EXACT rather than on a duration. A ratio and not the
    /// figures themselves because the two arms are the same work at two sizes, which is the shape
    /// Rule 3 asks for and the shape that survives a fixture edit.
    static let ticketSelectionFlat = 1.3

    /// `TicketsRoomCostTests` — placing the hero's pool may not cost more PER TICKET as the
    /// listing grows. Its own bound and not the selection's: the two claims are about different
    /// passes, and one moved to fit a red run must not move the other.
    ///
    /// Recorded: 1.8 chart children placed per ticket over a listing of 200 and over one of 2 000 ·
    /// M4 Pro · either · exact. The per-item chart search it replaced reads 9.48 times as much per
    /// ticket at the larger size. Rule 3's 1.3, as above.
    static let ticketPlacementFlat = 1.3

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

    /// `MinimapGeometryTests` — how much of a #650-shaped session the overview lane holds at once
    /// once it is drawn a mark a Turn (#1173).
    ///
    /// Recorded: 0.719 of the session in an 800pt lane, over 5,004 rows in 556 Turns · M4 Pro ·
    /// either · exact. A share and not a duration, so it reads the same on any box: the lane's
    /// height over the miniature's, both of which are arithmetic over measured heights.
    ///
    /// The same session a mark a ROW is 0.08 of itself — 5,000 marks needing a mark and a gap
    /// apiece in 800 points of lane — which is the reading #1173 was opened on. 0.70 is gated,
    /// which is the ticket's own bound and a hair under the figure.
    static let turnGrainCoverage = 0.70

    /// `MinimapCostTests` — a band far down the miniature is worth a BAND and not a position. Not
    /// equality, because the rows it lands on are of their own heights.
    ///
    /// Recorded: 355 marks in the band at the head, 356 half a session down, over the 2 408-row and
    /// 9 632-row readings · M4 Pro · either · exact. Twice is Rule 8's slack on a count, not Rule
    /// 7's on a duration: the two readings differ by 1 mark and a band that had started costing the
    /// session would read 1 664. Re-recorded for #1173, which moved both arms up to the lengths a
    /// mark a Turn no longer fits and changed the unit from rows to marks.
    static let bandPositionSlack = 2

    /// `MinimapCostTests` — a repaint of a band already painted comes off the caches, as a fraction
    /// of the first paint rather than as nothing.
    ///
    /// Recorded: 0 Core Text passes of 87 idle, and a handful of 87 when `ProseMetrics`'
    /// eight-measure drop lands mid-paint · M4 Pro · either · exact per run, both readings seen.
    /// Re-recorded for #1173, which moved the reading to the 200 rows this fixture still draws a
    /// mark a row — past that there is no glyph work to come off a cache. A quarter, which is
    /// 4x the worse reading — Rule 8's slack on a count and deliberately not Rule 7's 3x, because
    /// which of the two readings a run gets is decided by test ordering rather than by the lane. A
    /// repaint that had stopped coming off the caches costs all 32.
    static let repaintOffCachesFraction = 4

    /// `MinimapCostTests` — what a paint drawn a mark a TURN costs in glyph work (#1173).
    ///
    /// Recorded: 0 Core Text passes over the 2 408-row reading, painting a band and over a
    /// thirty-frame seam drag alike · M4 Pro · either · exact. The same fixture at 200 rows, which
    /// still draws a mark a row, reads 87 for the band and 1 291 for the drag — which is why zero
    /// is gated EXACTLY rather than with slack, and why both cases carry the row-grain arm beside
    /// it. A coarse mark is a Turn's extent, its ink and its share, all of them already reported by
    /// the reading, so a pass that measured a glyph here would be measuring something nobody asked
    /// for.
    static let coarsePaintTypesets = 0

    /// `MinimapCostTests` — a session of nothing but long markdown still pays only for the band. A
    /// heading and a paragraph a row, so a row is worth more than one pass.
    ///
    /// Recorded: 600 Core Text passes over 300 band marks — 2.0 a row — and the repaint 0 of those
    /// 600 · M4 Pro · either · exact. 3 gated, which is Rule 8's slack on a count. Re-recorded for
    /// #1173: a session of long markdown rows stays drawn a mark a row at this length, so the whole
    /// fitted miniature is the band.
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

    /// `SettledSessionCostTests` — the largest Session Argo has been given, measured whole before
    /// a row of it is drawn (ADR-0030, Rule 3).
    ///
    /// Three seconds, agreed in the grilling session #1109 records: a first open of a 63 MB Session
    /// may take that long, and a document whose geometry is still moving is not accepted at any
    /// speed. Recorded: 0.100 s of thread CPU over the checked-in synthetic's 459 rows taken
    /// serially, against 0.020 s of wall clock for the same document across cores · M4 Pro,
    /// loaded · debug · single pass, because a first pass over a cold prose cache IS the
    /// measurement.
    ///
    /// The one SECONDS budget in this file, and the one place a seconds budget is sound: what is
    /// bounded is what the reader WAITS, which is wall-clock by definition, and the bound is a
    /// ceiling somebody agreed to sit through rather than a ratio (`elapsedSeconds`). The slack is
    /// the argument — thirty times the recorded pass — so a loaded box moves the figure and
    /// not the verdict, while a pass that went back to a SwiftUI layout a row would read minutes.
    static let settledDocument = 3.0

    /// The seconds `MinimapFigureRecording` re-records, one entry a figure it prints.
    ///
    /// Recorded: over the 301-row reading · M4 Pro, **loaded** · both, as the two halves · the
    /// least of five interleaved rounds, each figure cold or least-of-N inside a round as its case
    /// describes. Re-recorded whole on the same box for #1111, which is why every figure moved:
    /// a prose row is now measured by the frame that draws it, so the measure pass no longer builds
    /// the lane's rectangles on its way past.
    ///
    /// Interleaved because a box picking up a neighbour drifts over a run: five debug rounds
    /// followed by five release ones read the measure pass as SLOWER optimised, purely because the
    /// load average went from 131 to 215 in between (#998).
    ///
    /// Nothing gates on these — a seconds gate on a shared laptop reads the box (`CostMeasure`).
    /// What they are for is the question no count can answer: what the app that SHIPS costs
    /// (ADR-0028 Consequences, and #998).
    static let feedMeasurePass = Figure(debug: 87.18, release: 79.42)
    /// A warm walk of the whole session, which happens on every reshape. The one path here the
    /// optimiser is worth more than a rounding error on, and ADR-0028 says why.
    static let sessionReading = Figure(debug: 1.10, release: 0.28)
    /// One band painted cold — the Core Text pass.
    static let bandPaintCold = Figure(debug: 4.44, release: 3.37)
    /// The same band repainted, which is what the reader feels on a scroll.
    static let bandPaintWarm = Figure(debug: 1.29, release: 0.89)
    /// One second of reading at frame rate inside the band the lane holds.
    static let sixtyScrolledFrames = Figure(debug: 75.47, release: 54.95)
    /// Thirty frames of a seam drag: the worst case the design has.
    static let thirtySeamFrames = Figure(debug: 80.27, release: 61.74)
    /// A band of nothing but long markdown, cold — the ceiling.
    static let markdownBandCold = Figure(debug: 9.04, release: 7.65)

    /// One recorded figure in milliseconds, in each of the two configurations. Both halves, because
    /// the gap is the finding: until #953 every figure in the epic was a `-Onone` number.
    struct Figure {
        let debug: Double
        let release: Double

        /// What the optimiser is worth on this path — the debug figure over the release one — and
        /// `nil` off a loaded laptop, where the quotient is the load average's as much as the
        /// optimiser's: the arms moved from 131 to 215 between them (#998).
        ///
        /// It is the one quantity here a gate could ever hold: its two halves are the SAME work in
        /// the same shape, which is what ADR-0028 Rule 8 asks of a quotient. `figureMachine` says
        /// why the seconds beside it are not.
        var optimiserFold: Double? {
            guard figureMachine == .quietRunner else { return nil }
            return (debug / release * 100).rounded() / 100
        }
    }

    /// Where every `Figure` above was taken, and the whole of what may be built on them. This is
    /// the ONE place that argument is stated; everything else cites it.
    ///
    /// A second is never bindable on either machine. `CLOCK_THREAD_CPUTIME_ID` still charges the
    /// cycles a thread stalls while on-core, so a reading carries whatever else the box was doing
    /// — 3.8x of it on a pointer-chase (`CostMeasure`, ADR-0028 Rule 8). A GitHub-hosted runner is
    /// quieter than a laptop with thirty agent builds on it and is still a shared, virtualised box
    /// with no clock guarantee, so `.quietRunner` ends these figures' PROVISIONAL status and
    /// nothing more (ADR-0028 Consequences, amended by #1024). What it arms is `optimiserFold`.
    ///
    /// One value for the block rather than a field each figure carries: all seven come off one
    /// interleaved run, and a file where they could differ would invite a half-recorded set. It is
    /// also the single line a real recording changes.
    static let figureMachine = Machine.loadedLaptop

    /// The two machines a `Figure` can come off, and no third.
    enum Machine: String {
        /// #953's M4 Pro with thirty other agent builds on it. A shape, never a number.
        case loadedLaptop = "loaded-laptop"
        /// `.github/workflows/figures.yml` — a `macos-26` runner running nothing but the harness.
        case quietRunner = "quiet-runner"
    }
}
