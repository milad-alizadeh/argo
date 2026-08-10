@testable import ArgoUI
import SwiftUI
import Testing

/// Whether the reading is still following the Session, over geometry alone.
///
/// The whole of this rule is arithmetic, and none of it needs a view: the one suite that drives a
/// real feed has to launch the app to say anything at all, which is the wrong place to establish
/// that a point short of the end still counts as the end. WHOSE scroll produced the geometry is
/// AppKit's answer now — only the reader's hand posts a live-scroll notification — so the suite
/// no longer has a phase vocabulary to test.
@Suite("Feed tail")
struct FeedTailTests {
    /// The pane and the reading every row below is measured in. Numbers rather than tokens: this is
    /// geometry arriving from a scroll view at runtime, not a measure the design system decides.
    private static let pane: CGFloat = 600
    private static let reading: CGFloat = 2000
    /// The offset at which the pane's floor sits exactly on the end of the reading.
    private static let end = reading - pane

    /// The end is a tolerance and not a point, because layout answers in fractions of one: a scroll
    /// that has settled at the end reports an offset a hair short of it, and a feed that dropped
    /// out of following there would offer the reader the way back to where they already are. It is
    /// not a screenful either — one row up is a reader who has scrolled.
    ///
    /// A reading shorter than its pane is the row that looks like an edge case and is not. It never
    /// scrolls, so zero is its only offset AND its end; read as "not following", the way-back
    /// control would stand permanently over a reading with nothing below it.
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
