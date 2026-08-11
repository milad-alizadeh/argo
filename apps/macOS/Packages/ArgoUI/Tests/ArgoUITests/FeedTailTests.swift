@testable import ArgoUI
import SwiftUI
import Testing

/// Whether the reading is still following the Session, over geometry alone. WHOSE scroll produced
/// the geometry is AppKit's answer — only the reader's hand posts a live-scroll notification — so
/// there is no phase vocabulary here to test.
@Suite("Feed tail")
struct FeedTailTests {
    /// The pane and the reading every row below is measured in. Numbers rather than tokens: this is
    /// geometry arriving from a scroll view at runtime, not a measure the design system decides.
    private static let pane: CGFloat = 600
    private static let reading: CGFloat = 2000
    /// The offset at which the pane's floor sits exactly on the end of the reading.
    private static let end = reading - pane

    /// The end is a tolerance and not a point: layout answers in fractions, so a scroll settled at
    /// the end reports an offset a hair short of it. A reading shorter than its pane never scrolls,
    /// so zero is its only offset AND its end, and it still counts as following.
    struct Row {
        let offset: CGFloat
        let reading: CGFloat
        let isFollowing: Bool
        let at: String
    }

    @Test(arguments: [
        Row(offset: end, reading: reading, isFollowing: true, at: "the very end"),
        Row(
            offset: end - FeedTail.slack / 2,
            reading: reading,
            isFollowing: true,
            at: "a hair short",
        ),
        Row(
            offset: end - FeedTail.slack - 1,
            reading: reading,
            isFollowing: false,
            at: "a row short",
        ),
        Row(offset: 0, reading: reading, isFollowing: false, at: "the start"),
        Row(offset: 0, reading: 200, isFollowing: true, at: "a reading inside its pane"),
    ])
    func `where the reading sits decides whether it is following`(row: Row) {
        #expect(
            FeedTail.isFollowing(offset: row.offset, pane: Self.pane, reading: row.reading)
                == row.isFollowing,
            "\(row.at)",
        )
    }
}
