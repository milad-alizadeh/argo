import Foundation

/// One measurement window of frame intervals, reduced to the figures a frame budget is read off.
///
/// Three shapes of file exist and none carries a version, so tell them apart by a key. A file with
/// `source` was written on or after #1566: the display ceiling is nested under it beside the
/// executable that wrote it. A file with `band` and a top-level `displayMaxFPS` was written on or
/// after #1544 and before #1566: the four percentiles are nested under `band`, and `passes` and
/// `passCosts` are there. A file with a top-level `p50MS` predates both and has no pass counters at
/// all. Nothing decodes any of them into this type — `FrameProbeReport` only ever encodes — so an
/// older file was read by `frame-band.py`, deleted with the rest of the probe tooling, which
/// re-derived the band from `timestamps` rather than reading the percentiles at all and reported an
/// absent counter as absent rather than as a cockpit that never redrew. Whatever reduces these
/// files next does the same, for the same reason.
struct FrameProbeSummary: Codable {
    /// Where the numbers came from, as against the numbers themselves.
    ///
    /// Every figure in the summary is stated against `displayMaxFPS`, which the probe reads off the
    /// screen the window is on rather than assuming: the same JSON has to stay comparable when a
    /// 120 Hz panel replaces a 60 Hz one, and a bare "58 fps" says nothing without the ceiling it
    /// was measured under.
    struct Source: Codable {
        /// The executable of the process that wrote this. Every worktree builds its own
        /// `Release/Argo.app` and they all carry the name, so a report naming no path could be
        /// crossed with another build's and nothing afterwards could tell (#1566).
        ///
        /// It is `arguments[0]`, which on macOS is exactly what `ps -o comm=` reports — measured:
        /// `cd /bin && ./sleep 20` reads back as `./sleep` there. That is what makes it the same
        /// string `hang-sample.sh` prints off `comm=` since #1560, which is the point: two tools
        /// naming one build two ways is the crossing this stops. It follows that the value is
        /// whatever the caller passed rather than a resolved path, and absolute only because
        /// LaunchServices passes an absolute one — `open -n`, which is how the probe is launched.
        ///
        /// Absent, never empty, if there is no argv: a report that cannot name its build has to
        /// read as one, and `""` would be a value shaped like an answer.
        var executablePath: String?
        var displayMaxFPS: Int
    }

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

    var source: Source
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
