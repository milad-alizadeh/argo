import Foundation

/// What a run of inter-frame intervals says about a scroll.
///
/// A value over the deltas rather than a running average, because the claim being made is about a
/// TAIL: a drag that holds 8ms for ninety-nine frames and spends 90ms on the hundredth reads as
/// perfect on a mean and is exactly the stutter a reader complains about. p95 and the worst frame
/// are the two numbers that survive that, and the dropped count is the target stated as a count.
struct FrameReading: Equatable {
    /// The 60fps floor, in milliseconds — the gate #516 names. A frame longer than this missed a
    /// refresh on a 60Hz display and two on a 120Hz one.
    static let floor = 1000.0 / 60

    let count: Int
    let p50: Double
    let p95: Double
    let worst: Double
    /// Frames longer than the floor. The target is "none of them", so this is the number the gate
    /// is actually read off.
    let dropped: Int

    init(milliseconds: [Double], floor: Double = FrameReading.floor) {
        let sorted = milliseconds.sorted()
        self.count = sorted.count
        self.p50 = Self.rank(sorted, at: 0.5)
        self.p95 = Self.rank(sorted, at: 0.95)
        self.worst = sorted.last ?? 0
        self.dropped = sorted.count { $0 > floor }
    }

    /// Nearest-rank rather than interpolated. An interval that was actually observed is a truer
    /// answer about a tail than an average of two that were not — and interpolation on a bimodal
    /// distribution (a clean cadence plus a handful of hitches) invents a value between the two
    /// modes that no frame ever took.
    private static func rank(_ sorted: [Double], at share: Double) -> Double {
        guard !sorted.isEmpty else { return 0 }
        let at = Int((share * Double(sorted.count)).rounded(.up)) - 1
        return sorted[min(max(at, 0), sorted.count - 1)]
    }
}
