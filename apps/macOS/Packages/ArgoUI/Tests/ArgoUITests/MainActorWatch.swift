import Foundation

/// How long the main actor was ever unavailable while something else ran — the one measurement that
/// says work is genuinely OFF it (ADR-0030, Rule 3).
///
/// It ticks on the main actor as fast as the main actor will let it, and records the longest gap
/// between two ticks. Work that had run on the main actor shows up as one gap as long as the work;
/// work that ran anywhere else leaves the ticks unbroken, because every suspension of it hands the
/// main actor straight back.
///
/// A wall clock, and one of the two places `CostMeasure` allows one: what is being measured IS a
/// wait, and what it is held against is a frame — a bound far above the scheduler's own noise.
@MainActor final class MainActorWatch {
    private(set) var longestGap: TimeInterval = 0
    private(set) var ticks = 0
    private var isDone = false

    /// The work this watch is about has finished. Called from the main actor by whatever it was
    /// watching, which is what ends the loop.
    func finished() {
        isDone = true
    }

    /// Ticks until `finished()`, or until the ceiling — so work that never finishes fails a case
    /// rather than hanging it.
    func run(ceiling: TimeInterval = 30) async {
        let opened = ContinuousClock.now
        var last = opened
        while !isDone {
            await Task.yield()
            let now = ContinuousClock.now
            longestGap = max(longestGap, Self.seconds(from: last, to: now))
            last = now
            ticks += 1
            guard Self.seconds(from: opened, to: now) < ceiling else { return }
        }
    }

    private static func seconds(from: ContinuousClock.Instant, to: ContinuousClock.Instant)
        -> TimeInterval {
        let taken = to - from
        return TimeInterval(taken.components.seconds)
            + TimeInterval(taken.components.attoseconds) / 1e18
    }
}
