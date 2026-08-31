import Foundation

/// One measurement window of frame intervals, reduced to the figures a frame budget is read off.
///
/// Every figure is stated against `displayMaxFPS`, which the probe reads off the screen the window
/// is on rather than assuming: the same JSON has to stay comparable when a 120 Hz panel replaces a
/// 60 Hz one, and a bare "58 fps" says nothing without the ceiling it was measured under.
struct FrameProbeSummary: Codable {
    /// Frames longer than a multiple of the budget — the dropped-frame proxy. A display link
    /// callback that arrives late is a frame the main thread did not get to in time.
    struct Overrun: Codable {
        var multiple: Double
        var count: Int
        var totalMS: Double
    }

    var displayMaxFPS: Int
    var frameBudgetMS: Double
    var frameCount: Int
    var wallSeconds: Double
    var effectiveFPS: Double
    var p50MS: Double
    var p95MS: Double
    var p99MS: Double
    var maxMS: Double
    /// Wall clock of the frame that ended the longest stall, so it can be put beside a driver line.
    var longestStallAt: Double
    var overruns: [Overrun]
    /// Wall clock of every frame. A driver prints its click stamps on the same clock, which is the
    /// only join that makes click-to-settled measurable without a second instrument.
    var timestamps: [Double]
}
