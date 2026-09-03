import ArgoDesign
import CoreGraphics

// A run of pictures, at the height its grid wraps to.
//
// The tiles are placed by `WrapFlow`, whose arithmetic is a `nonisolated static` over sizes alone —
// so this asks the very function that lays the row out rather than a second model of it. A shot's
// own width is `FeedShot.drawnWidth`, which is what the row, the lane and this all deal from
// (#1015).

extension FeedShapeHeight {
    /// The gallery's own height: its grid, and the air a run of pictures takes above and below it.
    ///
    /// The measure is the caller's rather than the row's, because a prompt's bubble wraps its
    /// pasted
    /// pictures across the inside of the bubble instead of across the column.
    static func shots(_ shots: [FeedShot], across measure: CGFloat) -> CGFloat {
        // The breath is the ROW's, not the pictures': `FeedGalleryRow` pads a run of none the same
        // as a run of six, so a gallery that lost its shots is still a row of that much air.
        grid(shots, across: measure) + ArgoFeedRow.shotBreath * 2
    }

    /// How tall the wrapped grid alone stands, breath excluded.
    static func grid(_ shots: [FeedShot], across measure: CGFloat) -> CGFloat {
        let sizes = shots.map {
            CGSize(width: $0.drawnWidth, height: ArgoFeedRow.shotHeight)
        }
        let places = WrapFlow.placements(
            of: sizes,
            in: measure,
            gaps: WrapFlow.Gaps(along: ArgoFeedRow.shotGap, between: ArgoFeedRow.shotGap),
        )
        return places.map(\.maxY).max() ?? 0
    }
}
