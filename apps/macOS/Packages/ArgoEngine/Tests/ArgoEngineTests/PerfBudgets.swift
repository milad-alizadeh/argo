@testable import ArgoEngine

/// Every figure this package's cost suites were RECORDED at, and the bound each gate derives from
/// one (ADR-0028 Rule 7, #953). `ArgoUITests` has its own, for `CostMeasure`'s reason.
///
/// Every entry reads the same way, and an entry that cannot fill the shape does not belong here:
///
///     Recorded: <what> · <machine> · <configuration> · <sampling>
///
/// - **Machine** — two spellings, and no third. `M4 Pro` is 12 cores, 48 GB, macOS 26.5.1, Swift
///   6.3.3. `Apple silicon laptop` is the whole of what is known about a figure predating this
///   file — including one that said "M4 MacBook Pro", probably this machine and never verified.
/// - **Configuration** — `debug` is `-Onone`. A census of bytes reads the same in any build and
///   says `either`.
/// - **Sampling** — `least of N` for warm work, because CPU noise is one-sided (`CostMeasure`);
///   `exact` for a count or a census that does not vary.
///
/// **Every figure below is PROVISIONAL**: taken in debug on a laptop, where ADR-0028's
/// Consequences require `macos-26` in release before the seconds-side budgets bind (#1024).
/// Nothing in this package gates on a second, so no bound here moves when they are re-recorded —
/// but the block ADR-0028 names is still up.
enum PerfBudgets {
    /// `HubJoinCostTests` — a Session's own content batch may not rebuild the join, whatever the
    /// roster holds.
    ///
    /// Recorded: 0 rebuilds over 500 batches, at 4 rows and at 200 · either · exact. Restoring
    /// `rebuild()` on this path makes it 500 at both.
    ///
    /// The same claim in seconds rides along here and BINDS nothing (ADR-0028 Rule 8, #1064): a
    /// quotient of 0.97–1.01 over six readings, each arm 5.9 ms of 500 batches · Apple silicon
    /// laptop · debug · least of 15, interleaved, three idle and three with ten spinners, with the
    /// same defect reading 36x. It is a figure and not a bound because its halves are fifty times
    /// apart in resident working set, which is a difference `CLOCK_THREAD_CPUTIME_ID` charges to
    /// the larger arm in every trial — so it read 1.53 on a hosted runner while the code stood
    /// still.
    static let batchRebuilds = 0

    /// `TranscriptSliceCostTests` — no single write may take more of a read than one slice,
    /// whatever the file's length.
    ///
    /// Recorded: 200 events a slice against a batch of 4 801 · exact. The count is the gate; the
    /// seconds below are why the count is 200 and BIND nothing (ADR-0028 Rule 8). Read off the
    /// shipped constant rather than restating it, so the figures and the bound cannot drift apart.
    ///
    /// Measured as the longest the main actor was unavailable while one whole read landed, by a
    /// clock only the main actor advances — a wall clock, for `MainActorWatch`'s reason: what is
    /// being measured IS a wait, and what it is held against is a frame. Over a 60 MB transcript of
    /// 4 801 records at 13 KB — the shape `SessionSelectionCostTests` records its own figures at —
    /// the gap is **3.6 ms taken whole against 0.5 ms in slices**, least of 3 each · M4 Pro ·
    /// debug. Neither is a dropped frame at that size; the point is that the first grows with the
    /// file and the second does not.
    ///
    /// **The same run is also what says #1166's two seconds are not here.** That read takes 0.70 s
    /// wall against 3.6 ms of work under the write, so 99.5% of the wait is the read itself — off
    /// the main actor, and untouched by this. EXTRAPOLATED and not measured: the ticket's own repro
    /// at 238 MB is about four times that file, which puts it near the two seconds it reported.
    ///
    /// **Why the gate is a count and not the frame budget #1166 asked for.** A frame-budget case
    /// only discriminates where the unsliced arm exceeds a frame, and at 0.75 µs an event that
    /// needs ~22 000 events — a 286 MB fixture, which no suite can carry. So the count is the gate
    /// and this is the reading behind it, which is ADR-0028 Rule 8's first instruction anyway.
    static let foldSlice = TranscriptSlice.events

    /// `HubRosterCostTests` — one `session(id:)` may not cost more as the roster grows.
    ///
    /// Recorded: 0.68 µs at both 8 rows and 64, over 32 observed Sessions · Apple silicon laptop ·
    /// debug
    /// · least of N over 500 lookups. Before the memo the same lookup cost 18 µs at 8 rows and
    /// 163 µs at 64 — a quotient of 9, against the 1.0 it reads now. Rule 3's 1.3, as above.
    ///
    /// Two figures from that run ride along here rather than as constants of their own, because no
    /// gate reads them and an unread constant is debt: one fold costs 98 µs and one memoised read
    /// 0.56 µs, against 75 µs for a read before the memo. What BINDS that pair is a COUNT of folds
    /// (Rule 8) — two unlike halves can move 3.8x on the machine alone.
    static let rosterLookupFlat = 1.3

    /// `SubagentCostTests` — a Subagent's batch, and the reading it feeds, may not fold the roster,
    /// whatever that roster holds.
    ///
    /// Recorded: 0 folds over 2 000 batches, at 4 rows and at 200 · either · exact. Routing the
    /// batch back into the join makes it one per batch at both. A READ moves no stamp, so that
    /// half of the old quotient's claim is dropped rather than restated — see the suite.
    ///
    /// The same claim in seconds rides along here and BINDS nothing (ADR-0028 Rule 8, #1065): a
    /// quotient of 0.99, 1.00 and 0.99 over three runs · Apple silicon laptop · debug · least of
    /// 10, interleaved, with the same defect reading 37x. It is a figure and not a bound because
    /// its halves are fifty times apart in resident working set, which is a difference
    /// `CLOCK_THREAD_CPUTIME_ID` charges to the larger arm in every trial — the failure mode that
    /// took `HubJoinCostTests` off a quotient.
    static let subagentReadingFolds = 0

    /// `MediaMemoryCostTests` — what a whole observed working set retains for its pictures, against
    /// what ONE of its Sessions would weigh held.
    ///
    /// Recorded: 2 300-fold — eight Sessions of six 200 KB captures weigh 9.6 MB of base64, of
    /// which one Session is 1.2 MB, and the whole set retains 5 KB · M4 Pro · either, a census of
    /// bytes · exact.
    ///
    /// **A hundredfold is 23x looser than the reading, which Rule 7 would not allow of a
    /// duration.**
    /// It predates this file and is kept rather than tightened, for a reason that has to be stated
    /// because this file exists to make exactly this visible: the gate is a CENSUS, and the failure
    /// it watches for is a stream holding pixels again — four orders of magnitude, not a drift. A
    /// bound at 3x the reading would instead track the fixture's own path lengths and the base64
    /// ratio, and go red on a change to neither. Tighten it the day a case exists that can tell a
    /// twofold regression from a longer temp directory.
    static let retainedSessionShare = 100.0

    /// `MediaMemoryCostTests` — the same claim from the other side: what is retained is per PICTURE
    /// and never per pixel, so quadrupling every capture leaves the census where it was.
    ///
    /// Recorded: 1.00 at 100 KB against 400 KB a capture · M4 Pro · either, a census · exact. Not
    /// equality only because the two fixtures' own paths differ by a character or two; a stream
    /// holding bytes again fails it at the ratio of the two sizes.
    static let retainedOverPictureSizeFlat = 1.1
}
