@testable import ArgoUI
import CoreGraphics
import Testing

/// Whether the feed is still following the Session, which is the one question the scroll behaviour
/// turns on: a reader at the bottom wants the newest line, and a reader who scrolled up to read
/// something wants the page they scrolled to and nothing moving under them.
@Suite("Feed tail")
struct FeedTailTests {
    /// A reading shorter than the pane it is in has no bottom to leave. It is all on screen, so
    /// the next line belongs under it.
    @Test
    func `a feed shorter than its pane is following`() {
        #expect(FeedTail.isFollowing(offset: 0, pane: 600, reading: 200))
    }

    @Test
    func `a feed scrolled to its last line is following`() {
        #expect(FeedTail.isFollowing(offset: 1400, pane: 600, reading: 2000))
    }

    /// Layout answers in fractions of a point and a scroll settles a hair short of its own end.
    /// A rule that demanded the exact bottom would drop the reader out of following on arrival at
    /// it, which is the one moment they most want to stay.
    @Test
    func `a feed a hair short of the bottom is still following`() {
        #expect(FeedTail.isFollowing(offset: 1399, pane: 600, reading: 2000))
    }

    @Test
    func `a feed scrolled up to read something is not following`() {
        #expect(!FeedTail.isFollowing(offset: 200, pane: 600, reading: 2000))
    }

    /// Rubber-banding past the end is still the end. A reader who over-drags at the bottom has not
    /// asked to stop following, and a rule that read the overshoot as a scroll-up would put the
    /// way-back-down control on screen at the exact moment there is nothing below.
    @Test
    func `a feed dragged past its own end is following`() {
        #expect(FeedTail.isFollowing(offset: 1480, pane: 600, reading: 2000))
    }

    /// The slack is a tolerance, not a screenful. A reader one row up has stopped following, or
    /// the feed would go on moving under the line they stopped at.
    @Test
    func `a feed one row above the bottom has stopped following`() {
        #expect(!FeedTail.isFollowing(offset: 1400 - FeedTail.slack - 1, pane: 600, reading: 2000))
    }
}
