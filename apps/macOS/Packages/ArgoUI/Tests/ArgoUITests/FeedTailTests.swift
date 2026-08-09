@testable import ArgoUI
import SwiftUI
import Testing

/// Whether the reading is still following the Session, over geometry and scroll phases alone.
///
/// The whole of this rule is arithmetic and a five-case enum, and none of it needs a view: the one
/// suite that drives a real feed has to launch the app to say anything at all, which is the wrong
/// place to establish that a point short of the end still counts as the end.
///
/// The two halves answer different questions and are both here. The geometry says WHERE the reading
/// is; the phase says WHOSE scroll put it there — and it is the second that stops a Session growing
/// under a reader from being read as the reader leaving the end.
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
    @Test(arguments: [
        (offset: end, reading: reading, isFollowing: true, at: "the very end"),
        (offset: end - FeedTail.slack / 2, reading: reading, isFollowing: true, at: "a hair short"),
        (offset: end - FeedTail.slack - 1, reading: reading, isFollowing: false, at: "a row short"),
        (offset: 0, reading: reading, isFollowing: false, at: "the start"),
        (offset: 0, reading: 200, isFollowing: true, at: "a reading inside its pane"),
    ])
    func `where the reading sits decides whether it is following`(
        row: (offset: CGFloat, reading: CGFloat, isFollowing: Bool, at: String),
    ) {
        #expect(
            FeedTail.isFollowing(offset: row.offset, pane: Self.pane, reading: row.reading)
                == row.isFollowing,
            "\(row.at)",
        )
    }

    /// The phases the READER produces, and the ones the app does. `follow()` scrolls this view
    /// itself, and a latch that listened to its own scroll would read a landing a hair short as the
    /// reader having left — which is the bug that made the feed stop following for good.
    @Test(arguments: [
        (phase: ScrollPhase.tracking, isTheirs: true),
        (phase: .interacting, isTheirs: true),
        (phase: .decelerating, isTheirs: true),
        (phase: .animating, isTheirs: false),
        (phase: .idle, isTheirs: false),
    ])
    func `only the reader's own scroll phases are read as the reader`(
        row: (phase: ScrollPhase, isTheirs: Bool),
    ) {
        #expect(FeedTail.isReaderDriven(row.phase) == row.isTheirs, "\(row.phase)")
    }
}
