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
    /// The pane every case below is measured in. A number rather than a token: this is geometry
    /// arriving from a scroll view at runtime, not a measure the design system decides.
    private let pane: CGFloat = 600

    @Test
    func `a reading scrolled to its very end is following`() {
        #expect(FeedTail.isFollowing(offset: 1400, pane: pane, reading: 2000))
    }

    /// The case an exact test gets wrong. Layout answers in fractions of a point, so a scroll that
    /// has settled at the end reports an offset a hair short of it — and a feed that dropped out of
    /// following at the moment the reader arrived would offer them the way back to where they are.
    @Test
    func `a reading a hair short of the end is still following`() {
        #expect(FeedTail.isFollowing(offset: 1400 - FeedTail.slack / 2, pane: pane, reading: 2000))
    }

    /// And the tolerance is a tolerance, not a screenful: one row up is a reader who has scrolled,
    /// and moving the page under them loses the line they were on.
    @Test
    func `a reading a row short of the end is not following`() {
        #expect(!FeedTail.isFollowing(offset: 1400 - FeedTail.slack - 1, pane: pane, reading: 2000))
    }

    @Test
    func `a reading at its start is not following`() {
        #expect(!FeedTail.isFollowing(offset: 0, pane: pane, reading: 2000))
    }

    /// A Session that has said a few lines never scrolls, so its only offset is zero — and that
    /// offset IS the end of it. A rule that read this as "not following" would stand the way-back
    /// control permanently over a reading with nothing below it.
    @Test
    func `a reading shorter than the pane is following at its only offset`() {
        #expect(FeedTail.isFollowing(offset: 0, pane: pane, reading: 200))
    }

    /// The phases the READER produces, and the ones the app does. `follow()` scrolls this view
    /// itself, and a latch that listened to its own scroll would read a landing a hair short as the
    /// reader having left — which is the bug that made the feed stop following for good.
    @Test
    func `only the reader's own scroll phases move the latch`() {
        #expect(FeedTail.isReaderDriven(.tracking))
        #expect(FeedTail.isReaderDriven(.interacting))
        #expect(FeedTail.isReaderDriven(.decelerating))
        #expect(!FeedTail.isReaderDriven(.animating))
        #expect(!FeedTail.isReaderDriven(.idle))
    }
}
