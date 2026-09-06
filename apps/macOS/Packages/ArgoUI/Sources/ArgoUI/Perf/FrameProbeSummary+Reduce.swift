import Foundation

extension FrameProbeSummary {
    /// Reduces the raw per-frame wall stamps. Percentiles are nearest-rank over the sorted
    /// intervals, which needs no interpolation and never invents a value no frame had.
    init(stamps: [Double], displayMaxFPS: Int) {
        let budget = 1000 / Double(max(displayMaxFPS, 1))
        let intervals = zip(stamps.dropFirst(), stamps).map { ($0 - $1) * 1000 }
        let sorted = intervals.sorted()
        let wall = (stamps.last ?? 0) - (stamps.first ?? 0)
        let worst = intervals.indices.max { intervals[$0] < intervals[$1] }
        self.displayMaxFPS = displayMaxFPS
        frameBudgetMS = budget
        frameCount = stamps.count
        wallSeconds = wall
        effectiveFPS = wall > 0 ? Double(intervals.count) / wall : 0
        p50MS = Self.percentile(sorted, 0.5)
        p95MS = Self.percentile(sorted, 0.95)
        p99MS = Self.percentile(sorted, 0.99)
        maxMS = sorted.last ?? 0
        longestStallAt = worst.map { stamps[$0 + 1] } ?? 0
        overruns = [1.0, 2.0, 4.0].map { Self.overrun(intervals, budget, $0) }
        timestamps = stamps
    }

    static func percentile(_ sorted: [Double], _ fraction: Double) -> Double {
        guard !sorted.isEmpty else { return 0 }
        let rank = Int((fraction * Double(sorted.count)).rounded(.up)) - 1
        return sorted[min(max(rank, 0), sorted.count - 1)]
    }

    static func overrun(_ intervals: [Double], _ budget: Double, _ multiple: Double) -> Overrun {
        let late = intervals.filter { $0 > budget * multiple }
        return Overrun(multiple: multiple, count: late.count, totalMS: late.reduce(0, +))
    }
}
