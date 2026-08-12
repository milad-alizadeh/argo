import Foundation

/// The shape of the reading, as the overview lane needs it: every row's measured height and the
/// gutters around them. Not where the reading sits — that moves at frame rate and this does not.
struct MinimapReading: Equatable {
    /// Every row's height in document points, in the order they are read.
    var rowHeights: [CGFloat] = []
    /// How much of the reading is on screen at once — the clip view's own height.
    var viewportHeight: CGFloat = 0
    /// The feed's gutters, above the first row and under the last. Part of what the reader can
    /// scroll over, so part of what the lane maps.
    var topInset: CGFloat = 0
    var bottomInset: CGFloat = 0
}
