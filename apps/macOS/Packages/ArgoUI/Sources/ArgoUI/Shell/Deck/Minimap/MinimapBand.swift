import Foundation

/// The slice of the miniature the lane keeps as pixels, which is what bounds its memory:
/// `laneWidth × bandLaneHeights × laneHeight × backingScale² × 4` bytes. At 112pt beside a 600pt
/// deck on a Retina display that is 3.1 MiB, and 7.2 MiB down a 1,400pt one. It is the same at ten
/// rows as at ten thousand, which is the property that matters.
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

    /// A band centred on the lane's window, clamped to the miniature at both ends — so the slack is
    /// the same in either direction, except at the ends where there is nothing beyond to draw.
    static func around(_ window: ClosedRange<CGFloat>, of whole: CGFloat, reach: CGFloat) -> Self {
        let height = min(max(0, whole), reach)
        let centre = (window.lowerBound + window.upperBound) / 2
        let origin = min(max(0, centre - height / 2), max(0, whole - height))
        return MinimapBand(origin: origin, height: height)
    }
}
