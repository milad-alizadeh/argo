/// Every figure this package's cost suites were RECORDED at, and the bound each gate derives from
/// one (ADR-0028 Rule 7, #953).
///
/// ONE FILE, because a figure kept beside the assertion it justifies is a figure nobody re-reads.
/// `MinimapCostTests` recorded 142 ms in its own header and asserted `cost < 4` — 28x looser than
/// the thing it measured, and green through a twentyfold regression in the path it was written to
/// hold. Gathered here, a bound that has drifted away from its figure is visible by looking, and a
/// figure with no bound is visible too.
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
/// A COUNT and a census read the same in both; a seconds figure does not, and says which it is.
///
/// **Sampling.** `least of N` for warm work, because CPU noise is one-sided and a minimum
/// converges on the intrinsic cost from above (`CostMeasure`). `cold` for a first pass over an
/// empty store, which IS the measurement and cannot honestly be repeated.
///
/// **A loaded box.** Where an entry says `loaded`, other agents were building on the machine while
/// it was taken. Such a figure is an upper bound on that machine and nothing better, which is why
/// nothing here gates on seconds directly.
///
/// Two files rather than one, and for `CostMeasure`'s reason: `ArgoEngine` and `ArgoUI` are
/// separate packages with no test target between them, and sharing would mean a third package
/// existing so that a list of numbers could be imported twice.
enum PerfBudgets {
    /// `HubJoinCostTests` — a Session's own content batch may not cost more as the roster grows.
    ///
    /// Recorded: 0.97–1.01 over six readings, never above 1.02, each arm 5.9 ms of 500 batches ·
    /// Apple silicon laptop · debug · least of 15, interleaved, three idle and three with ten
    /// spinners. Restoring `rebuild()` on this path takes the quotient to 36x.
    ///
    /// The bound is ADR-0028 Rule 3's own 1.3 — 1.3x the recorded reading, where the assertion this
    /// file exists because of was 28x it.
    static let batchOverRosterFlat = 1.3

    /// `HubRosterCostTests` — one `session(id:)` may not cost more as the roster grows.
    ///
    /// Recorded: 0.68 µs at both 8 rows and 64, over 32 observed Sessions · M4 MacBook Pro · debug
    /// · least of N over 500 lookups. Before the memo the same lookup cost 18 µs at 8 rows and
    /// 163 µs at 64 — a quotient of 9, against the 1.0 it reads now.
    ///
    /// Two more figures from the same run ride along here rather than as constants of their own,
    /// because no gate reads them and an unread constant is debt: one fold costs 98 µs and one
    /// memoised read 0.56 µs, against 75 µs for a read before the memo. What BINDS that pair is a
    /// COUNT of folds — two unlike halves can move by 3.8x on the machine alone (ADR-0028 Rule 8),
    /// and the count says the same thing exactly.
    static let rosterLookupFlat = 1.3

    /// `MediaMemoryCostTests` — what a whole observed working set retains for its pictures, against
    /// what ONE of its Sessions would weigh held.
    ///
    /// Recorded: 2 300-fold — eight Sessions of six 200 KB captures weigh 9.6 MB of base64, of
    /// which one Session is 1.2 MB, and the whole set retains 5 KB · M4 Pro · configuration-free, a
    /// census of bytes rather than a duration.
    ///
    /// A hundredfold is the bound: twenty-three times inside the reading, and a stream that went
    /// back to holding the pixels fails it by four orders of magnitude.
    static let retainedSessionShare = 100.0

    /// `MediaMemoryCostTests` — the same claim from the other side: what is retained is per PICTURE
    /// and never per pixel, so quadrupling every capture leaves the census where it was.
    ///
    /// Recorded: 1.00 at 100 KB against 400 KB a capture · M4 Pro · configuration-free, a census.
    /// The bound is not equality only because the two fixtures' own paths differ by a character or
    /// two; a stream holding bytes again fails it at the ratio of the two sizes.
    static let retainedOverPictureSizeFlat = 1.1
}
