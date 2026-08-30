import Darwin

/// What a cost budget in this suite is measured in: the CPU a piece of work SPENT, never the
/// seconds that passed while it ran (ADR-0028 Rule 7).
///
/// The engine's own copy of the primitive `ArgoUITests` measures with, and deliberately a copy: the
/// two suites are separate packages with no test target between them, and a shared one would be a
/// third package existing only so a nine-line clock could be imported twice.
///
/// `CLOCK_THREAD_CPUTIME_ID` rather than the process clock, because `swift test` runs the rest of
/// the suite in parallel on other threads, and a wall clock would measure the machine rather than
/// the work (#918).
enum CostMeasure {
    /// The CPU `work` spent on the calling thread.
    static func cpuSeconds(_ work: () -> Void) -> Double {
        let before = threadCPUSeconds()
        work()
        return threadCPUSeconds() - before
    }

    /// The cheapest `work` came out over `trials` — the best available estimate of what it COSTS
    /// rather than of what else the machine was doing. Noise is one-sided: a cache miss, a page
    /// fault and a preemption only ever ADD, so the minimum converges on the intrinsic cost from
    /// above. Never use it where the FIRST run is the measurement, as a cold cache is.
    static func leastCPUSeconds(trials: Int = 7, of work: () -> Void) -> Double {
        (0 ..< trials).map { _ in cpuSeconds(work) }.min() ?? 0
    }

    private static func threadCPUSeconds() -> Double {
        var spec = timespec()
        clock_gettime(CLOCK_THREAD_CPUTIME_ID, &spec)
        return Double(spec.tv_sec) + Double(spec.tv_nsec) / 1e9
    }
}
