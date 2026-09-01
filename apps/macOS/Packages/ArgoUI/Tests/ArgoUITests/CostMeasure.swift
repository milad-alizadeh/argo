import Darwin

/// What a cost budget is measured in: the CPU a piece of work SPENT, never the seconds that passed
/// while it ran.
///
/// A wall clock on a shared machine measures the machine (#918). `FeedScaleTests` failed by 5%
/// whenever several agents happened to be building on the same Mac — the pass under test had not
/// changed, the box had, and a performance claim a busy machine can falsify pins nothing.
///
/// Time the scheduler takes away costs nothing here, so the reading holds up on a busy box FAR
/// better than a wall clock — but not exactly, and a budget must not assume it does. Thread CPU
/// excludes the time the thread was off-core; it still counts the cycles it stalled while on it.
/// Measured on this machine, idle against twenty-four spinners: a fixed arithmetic loop reads
/// within 0.4%, and a fixed pointer-chase over 64 MB swings 3.8x, because cache and
/// memory-bandwidth contention is charged to whoever is stalling. Core assignment and clock are not
/// normalised away either — a thread resumed from a short sleep is placed and clocked differently
/// from one that has been running flat out.
///
/// So: prefer a COUNT to any of these wherever a count exists, since a count is exactly
/// load-independent rather than approximately. And where a budget is a ratio (ADR-0028 Rule 7), the
/// two halves must do the same KIND of work in the same shape — same memory profile, both
/// continuous or both fragmented — or their inflation factors do not cancel and the quotient reads
/// the machine. `MinimapWalkCostTests` documents the flake that taught this.
///
/// `CLOCK_THREAD_CPUTIME_ID` rather than the process clock: everything measured through this runs
/// on the thread that calls it, and the process is running the rest of the suite in parallel.
func cpuSeconds(_ work: () -> Void) -> Double {
    let before = threadCPUSeconds()
    work()
    return threadCPUSeconds() - before
}

/// The cheapest `work` came out over `trials`, which is the best available estimate of what it
/// COSTS rather than of what happened to it.
///
/// Noise is one-sided: a cache miss, a page fault, a frequency step and a preemption only ever ADD.
/// So the minimum converges on the intrinsic cost from above, while a single sample or a mean
/// carries whatever else the machine was doing. Use it wherever repeating the work is honest — not
/// where a first run is the measurement, as a cold cache is.
func leastCPUSeconds(trials: Int = 5, of work: () -> Void) -> Double {
    (0 ..< trials).map { _ in cpuSeconds(work) }.min() ?? 0
}

/// Two ways of doing the same job, measured against each other trial by trial.
///
/// Interleaved rather than timed one after the other, and warmed before either is counted: a
/// machine drifts over the length of a run — thermally, and as the other suites land on it — so
/// arms measured in blocks are compared across that drift as well as against each other. Alternated
/// they ride it together, and each PAIR is a comparison the drift cannot reach.
///
/// The pairs are returned rather than a verdict, because how much of a saving is honest to demand
/// is the caller's question and the answer is not the same on two machines. What survives the move
/// is the SIGN of each pair — see `FeedRowShapeTests`.
func pairedCPUSeconds(
    trials: Int = 7,
    _ first: () -> Void,
    against second: () -> Void,
)
    -> [(first: Double, second: Double)] {
    first()
    second()
    return (0 ..< trials).map { _ in (first: cpuSeconds(first), second: cpuSeconds(second)) }
}

private func threadCPUSeconds() -> Double {
    var spec = timespec()
    clock_gettime(CLOCK_THREAD_CPUTIME_ID, &spec)
    return Double(spec.tv_sec) + Double(spec.tv_nsec) / 1e9
}
