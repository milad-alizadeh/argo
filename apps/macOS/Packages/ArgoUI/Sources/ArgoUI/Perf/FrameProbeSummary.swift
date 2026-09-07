import Foundation

/// One measurement window of frame intervals, reduced to the figures a frame budget is read off.
///
/// Every figure is stated against `displayMaxFPS`, which the probe reads off the screen the window
/// is on rather than assuming: the same JSON has to stay comparable when a 120 Hz panel replaces a
/// 60 Hz one, and a bare "58 fps" says nothing without the ceiling it was measured under.
///
/// Two shapes of file exist and neither carries a version, so tell them apart by a key. A file with
/// `band` was written on or after #1544: the four percentiles are nested under it, and `passes` and
/// `passCosts` are there. A file with a top-level `p50MS` predates it and has no pass counters at
/// all. `frame-band.py` reads either, because it re-derives the band from `timestamps` rather than
/// reading the percentiles at all, and it reports an absent counter as absent rather than as a
/// cockpit that never redrew.
struct FrameProbeSummary: Codable {
    /// Frames longer than a multiple of the budget — the dropped-frame proxy. A display link
    /// callback that arrives late is a frame the main thread did not get to in time.
    struct Overrun: Codable {
        var multiple: Double
        var count: Int
        var totalMS: Double
    }

    /// Where the intervals fell. Nearest-rank, so no figure here is one no frame had.
    struct Band: Codable {
        var p50MS: Double
        var p95MS: Double
        var p99MS: Double
        var maxMS: Double
    }

    /// How often the window was re-derived — see `FrameProbePass`. `peakPerSecond` is the busiest
    /// single second rather than a percentile: a storm is a burst, and a mean of 3 hides sixty of
    /// them landing inside one frame.
    struct Passes: Codable {
        var count: Int
        var perSecond: Double
        var peakPerSecond: Int
        /// Wall clock of each, on the same clock as `timestamps` — so a stall can be read against
        /// the passes that landed inside it rather than against the run's average.
        var stamps: [Double]
    }

    /// And what they cost. `msPerSecond` is the figure that says whether to make the pass cheaper
    /// or to make it rarer: a millisecond spent thirty times a second and thirty spent once are
    /// the same share of the main thread and are not the same bug.
    struct PassCosts: Codable {
        var medianMS: Double
        var maxMS: Double
        var msPerSecond: Double
        /// Each pass's own cost, kept beside the reduced figures the way the frame stamps are, so
        /// a reader can recompute all of this with the launch discarded. The launch passes are the
        /// expensive ones and they are not what any of this is about.
        var eachMS: [Double]
    }

    var displayMaxFPS: Int
    var frameBudgetMS: Double
    var frameCount: Int
    var wallSeconds: Double
    var effectiveFPS: Double
    var band: Band
    /// Wall clock of the frame that ended the longest stall, so it can be put beside a driver line.
    var longestStallAt: Double
    var overruns: [Overrun]
    var passes: Passes
    var passCosts: PassCosts
    /// Wall clock of every frame. A driver prints its click stamps on the same clock, which is the
    /// only join that makes click-to-settled measurable without a second instrument.
    var timestamps: [Double]
}
