import Foundation

/// The slice of the miniature the lane keeps as pixels.
///
/// One bitmap of the WHOLE miniature is not affordable — its height grows with the session, so a
/// long one reaches tens of megabytes. A band is a few lane-heights tall and costs the same however
/// long the session runs, which is the bound the lane's memory has (#658).
///
/// The bound in full: `laneWidth × bandLaneHeights × laneHeight × backingScale² × 4` bytes. At the
/// lane's 112pt beside a 600pt deck on a Retina display that is 224 × 3,600 × 4 = 3.1 MiB, and it
/// is the same at ten rows as at ten thousand.
struct MinimapBand: Equatable {
    /// Where the band starts in the miniature, counted down from its head.
    let origin: CGFloat
    let height: CGFloat

    var range: ClosedRange<CGFloat> {
        origin ... origin + height
    }

    /// Whether the lane's window is wholly inside this band — the test for whether a scroll is a
    /// compositor move or a redraw.
    func covers(_ window: ClosedRange<CGFloat>) -> Bool {
        origin <= window.lowerBound && window.upperBound <= origin + height
    }

    /// A band centred on the lane's window, clamped to the miniature at both ends — so the reader
    /// has the same slack in either direction wherever they are, except at the very ends where
    /// there is nothing beyond to draw.
    static func around(_ window: ClosedRange<CGFloat>, of whole: CGFloat, reach: CGFloat) -> Self {
        let height = min(max(0, whole), reach)
        let centre = (window.lowerBound + window.upperBound) / 2
        let origin = min(max(0, centre - height / 2), max(0, whole - height))
        return MinimapBand(origin: origin, height: height)
    }
}
