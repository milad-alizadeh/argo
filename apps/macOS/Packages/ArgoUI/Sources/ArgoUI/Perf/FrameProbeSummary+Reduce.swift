import Foundation

extension FrameProbeSummary {
    /// Reduces the raw per-frame wall stamps. Percentiles are nearest-rank over the sorted
    /// intervals, which needs no interpolation and never invents a value no frame had.
    init(stamps: [Double], passes: [Double], passCosts: [Double], source: Source) {
        let budget = 1000 / Double(max(source.displayMaxFPS, 1))
        let intervals = zip(stamps.dropFirst(), stamps).map { ($0 - $1) * 1000 }
        let sorted = intervals.sorted()
        let wall = (stamps.last ?? 0) - (stamps.first ?? 0)
        let worst = intervals.indices.max { intervals[$0] < intervals[$1] }
        self.source = source
        frameBudgetMS = budget
        frameCount = stamps.count
        wallSeconds = wall
        effectiveFPS = wall > 0 ? Double(intervals.count) / wall : 0
        band = Band(
            p50MS: Self.percentile(sorted, 0.5),
            p95MS: Self.percentile(sorted, 0.95),
            p99MS: Self.percentile(sorted, 0.99),
            maxMS: sorted.last ?? 0,
        )
        longestStallAt = worst.map { stamps[$0 + 1] } ?? 0
        overruns = [1.0, 2.0, 4.0].map { Self.overrun(intervals, budget, $0) }
        self.passes = Self.rate(of: passes, over: wall)
        self.passCosts = Self.spend(of: passCosts, over: wall)
        timestamps = stamps
    }

    /// Rated over the FRAME window, not the passes' own span: the passes that build the view the
    /// display link hangs off happen before the first frame, and dividing by their own span would
    /// rate a launch burst against a wall clock that had barely started.
    static func rate(of passes: [Double], over wall: Double) -> Passes {
        Passes(
            count: passes.count,
            perSecond: wall > 0 ? Double(passes.count) / wall : 0,
            peakPerSecond: busiestSecond(passes),
            stamps: passes,
        )
    }

    static func spend(of costs: [Double], over wall: Double) -> PassCosts {
        let ranked = costs.sorted()
        return PassCosts(
            medianMS: percentile(ranked, 0.5),
            maxMS: ranked.last ?? 0,
            msPerSecond: wall > 0 ? costs.reduce(0, +) / wall : 0,
            eachMS: costs,
        )
    }

    /// The most stamps inside any one-second window, by a walk over the sorted stamps rather than
    /// by bucketing to whole seconds — a burst that straddles a bucket edge is still a burst.
    static func busiestSecond(_ stamps: [Double]) -> Int {
        let sorted = stamps.sorted()
        var busiest = 0
        var opening = 0
        for (closing, stamp) in sorted.enumerated() {
            while sorted[opening] < stamp - 1 {
                opening += 1
            }
            busiest = max(busiest, closing - opening + 1)
        }
        return busiest
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
