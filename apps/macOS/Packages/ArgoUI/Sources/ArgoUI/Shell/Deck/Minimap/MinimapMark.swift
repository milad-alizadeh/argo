import Foundation

/// One drawn rectangle of the miniature: where it sits down the lane, how tall it stands, how far
/// it runs across, and what it is drawn as.
///
/// A row makes several of these — one per line of prose, three for a mutation that says what it did
/// in lines. That is the whole of #382: the lane is the rows' own shapes at the lane's own scale,
/// not one bar apiece.
struct MinimapMark: Equatable {
    let y: CGFloat
    let height: CGFloat
    /// How far across the drawable width it runs, as shares of it.
    let span: ClosedRange<CGFloat>
    let ink: FeedInk
}
