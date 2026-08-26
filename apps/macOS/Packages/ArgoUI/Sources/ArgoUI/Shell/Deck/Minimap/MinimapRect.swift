import Foundation

/// One drawn rectangle of the miniature: where it sits down the lane, how tall it stands, how far
/// it runs across, and how it is drawn.
///
/// A row makes several of these — one per line of prose, one per cell of a table, one per piece of
/// a call's sentence. That is the whole of #382: the lane is the rows' own shapes at the lane's own
/// scale, not one bar apiece.
struct MinimapRect: Equatable {
    let y: CGFloat
    let height: CGFloat
    /// How far across the drawable width it runs, as shares of it.
    let span: ClosedRange<CGFloat>
    let ink: FeedInk
    /// Filled, stroked, a hairline or the whole width. The ROW's claim, not the ink's: a question's
    /// card is stroked around words that are filled, and both are the one attention ink.
    let shape: FeedInk.Shape

    /// A span, ordered and held inside the lane. The one place a rect's bounds are built.
    static func span(_ from: CGFloat, _ to: CGFloat) -> ClosedRange<CGFloat> {
        let low = min(max(0, from), 1)
        let high = min(max(0, to), 1)
        return min(low, high) ... max(low, high)
    }
}
