import Foundation

/// The shape of the reading, as the overview lane needs it: every row measured and read, and the
/// gutters around them. Not where the reading sits — that moves at frame rate and this does not.
package struct MinimapReading: Equatable {
    /// Every row in the order they are read: its measured height, the shapes it is drawn as, and
    /// the Turn boundaries it carries (#382).
    package var rows: [MinimapRow] = []
    /// How wide the rows are actually drawn — the feed column, up to the reading measure it stops
    /// at. The lane's compression is derived from this and its own width, so the miniature keeps
    /// the reading's aspect ratio; it moves with both deck seams, which is why it is measured
    /// rather than assumed.
    var columnWidth: CGFloat = 0
    /// How much of the reading is on screen at once — the clip view's own height.
    var viewportHeight: CGFloat = 0
    /// The feed's gutters, above the first row and under the last. Part of what the reader can
    /// scroll over, so part of what the lane maps.
    var topInset: CGFloat = 0
    var bottomInset: CGFloat = 0
}
