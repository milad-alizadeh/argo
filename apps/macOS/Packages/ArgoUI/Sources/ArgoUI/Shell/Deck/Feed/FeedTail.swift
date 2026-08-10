import SwiftUI

/// The end of the reading: whether the reader is at it, and what was said since they left it.
///
/// Arithmetic and nothing else, which is why it is testable without a view. The scrolling itself
/// is `FeedTable`'s; these are the two claims about the END that survive whoever scrolls.
enum FeedTail {
    /// How far short of the end still counts as the end.
    ///
    /// Layout answers in fractions of a point and a settled scroll lands a hair short of its own
    /// end, so an exact test would drop the reader out of following at the moment they arrive. A
    /// tolerance and not a screenful: one row up is a reader who has scrolled.
    nonisolated static let slack: CGFloat = ArgoSpacing.base

    /// Whether the reading is still following the Session.
    ///
    /// There are only two honest things to do about a transcript growing under the reader: follow
    /// the newest line, or hold the page they scrolled to. Which is right is not a setting — it is
    /// where they are. Someone at the bottom is watching; someone who scrolled up is reading, and
    /// moving that page under them loses the line they were on.
    ///
    /// Read only of a geometry the reader themselves produced. A Session appending a row changes
    /// every term of this without anybody having done anything, so read of that one it says the
    /// reader left an end that in fact moved away from them.
    nonisolated static func isFollowing(offset: CGFloat, pane: CGFloat, reading: CGFloat) -> Bool {
        offset + pane >= reading - slack
    }

    /// How much the agent has SAID since the reader left the end of the reading.
    ///
    /// Messages and nothing else. A working agent produces overwhelmingly calls, so a count of
    /// every appended row reads `247` after five minutes and means only "a lot"; a count of what
    /// was said stays a number a reader can act on, and a burst of forty edits collapsing to `2` is
    /// right, because the two paragraphs are what they want to catch up on. The consequence is
    /// deliberate: a long stretch of work with no prose leaves the control bare — the reading is
    /// still visibly detached, but nothing was said and this does not claim otherwise.
    ///
    /// Half record and half reader, which is why it is here rather than on `FeedProjection`: the
    /// projection is a function of the event stream and knows nothing about where a reader stopped.
    ///
    /// `since` is the last row present when following broke, held as a row id rather than an index
    /// — #476 standardised the reader's place on a row id, and one notion of "where I am" is
    /// enough. An id this reading does not hold counts nothing, which is the degrade-down rule:
    /// a place that is not in the record is not a place prose can be counted from.
    nonisolated static func newMessages(in rows: [FeedRow], since: FeedRow.ID) -> Int {
        guard let left = rows.firstIndex(where: { $0.id == since }) else { return 0 }
        return rows[rows.index(after: left)...].count(where: \.isMessage)
    }
}
