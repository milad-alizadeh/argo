import CoreGraphics

// The numbers a row height is bounded by: what an unmeasured row is assumed to stand at, how
// many are squared up per batch, and the ceiling a measured one is held under.

extension FeedTableCoordinator {
    /// What an unmeasured row is assumed to stand at — a few lines of prose. An estimate close
    /// to the truth keeps the table from speculatively realising twice the rows a wheel tick
    /// will actually show, which is work thrown away at frame rate.
    nonisolated static let estimatedRowHeight: CGFloat = ArgoFeedRow.lineHeight * 3

    /// How many rows one batch of the chunked full re-measure takes on. Each is a full SwiftUI
    /// layout, so the batch is what a frame can afford rather than what the table would like.
    nonisolated static let remeasureBatch = 50

    /// The tallest a single row may claim to be. Far above any real one, and far below AppKit's
    /// ±2^45 geometry window, which `NSTableView` leaves once summed origins pass it.
    nonisolated static let maxRowHeight: CGFloat = 100_000

    /// A measured height, or the estimate when it is one no row could truly stand at.
    ///
    /// Row content that flexes vertically takes the whole proposal, and the ruler proposes an
    /// unbounded one — a row measured at 1.2e308 turns the table's origin arithmetic into NaN and
    /// kills the window.
    nonisolated static func usableHeight(_ height: CGFloat) -> CGFloat {
        guard height.isFinite, height >= 0, height <= maxRowHeight else {
            return estimatedRowHeight
        }
        return height
    }
}
