import CoreGraphics

/// Whether the feed is still following the Session.
///
/// A live transcript grows under the reader, and there are only two honest things to do about it:
/// follow the newest line, or hold the page they scrolled to. Which one is right is not a setting —
/// it is where they are. A reader at the bottom is watching; a reader who scrolled up is reading,
/// and moving that page under them loses the line they were on.
///
/// A value rather than a view's private guess, so the rule is checkable: whether a feed follows is
/// the whole of this ticket's scrolling behaviour, and it is the one part of it a test can hold.
enum FeedTail {
    /// How far from the bottom still counts as the bottom.
    ///
    /// Layout answers in fractions of a point and a settled scroll lands a hair short of its own
    /// end, so an exact test would drop the reader out of following on ARRIVING at the tail. A
    /// tolerance and not a screenful: one row up is a reader who scrolled.
    static let slack: CGFloat = 8

    /// `offset` is how far the reading has been scrolled, `pane` the height on screen and
    /// `reading` the height of the whole feed. A reading that fits, or one scrolled to its end —
    /// or past it, which is a drag and not a decision — is following.
    static func isFollowing(offset: CGFloat, pane: CGFloat, reading: CGFloat) -> Bool {
        offset + pane >= reading - slack
    }
}
