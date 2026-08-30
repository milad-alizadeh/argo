import Darwin

/// What a cost budget in this package is measured in: the CPU a piece of work SPENT, never the
/// seconds that passed while it ran (ADR-0028 Rule 7).
///
/// A wall clock on a shared machine measures the machine (#918) — the suite builds and runs beside
/// whatever else is on the box, and a performance claim a busy laptop can falsify pins nothing.
/// Time the scheduler takes away costs nothing here, so the reading is the same idle and loaded.
///
/// `CLOCK_THREAD_CPUTIME_ID` rather than the process clock: everything measured through this runs
/// on the thread that calls it, and the process is running the rest of the suite in parallel.
///
/// Deliberately a copy of the `ArgoUITests` primitive rather than a shared one: the two suites are
/// separate packages with no test target between them, and sharing would mean a third package
/// existing only so a nine-line clock could be imported twice.
func threadCPUSeconds() -> Double {
    var spent = timespec()
    clock_gettime(CLOCK_THREAD_CPUTIME_ID, &spent)
    return Double(spent.tv_sec) + Double(spent.tv_nsec) / 1e9
}

/// The CPU `work` spent on the calling thread.
func cpuSeconds(_ work: () -> Void) -> Double {
    let started = threadCPUSeconds()
    work()
    return threadCPUSeconds() - started
}

/// The cheapest reading `work` came out at over `trials`, which is the best available estimate of
/// what it COSTS rather than of what happened to it. Noise is one-sided — a cache miss, a page
/// fault, a frequency step and a preemption only ever ADD — so the minimum converges on the
/// intrinsic cost from above where a mean carries whatever else the machine was doing. Never use it
/// where the FIRST run is the measurement, as a cold cache is.
func leastCPUSeconds(trials: Int = 7, of work: () -> Void) -> Double {
    var least = Double.greatestFiniteMagnitude
    for _ in 0 ..< trials {
        least = min(least, cpuSeconds(work))
    }
    return least
}
