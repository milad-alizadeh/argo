import SwiftUI

/// The end of the reading: whether the reader is at it, and what was said since they left it.
enum FeedTail {
    /// How far short of the end still counts as the end.
    ///
    /// Layout answers in fractions of a point and a settled scroll lands a hair short of its own
    /// end, so an exact test would drop the reader out of following at the moment they arrive. A
    /// tolerance and not a screenful: one row up is a reader who has scrolled.
    nonisolated static let slack: CGFloat = ArgoSpacing.base

    /// Whether the reading is still following the Session.
    ///
    /// Read only of a geometry the reader themselves produced. A Session appending a row changes
    /// every term of this without anybody having done anything, so read of that one it says the
    /// reader left an end that in fact moved away from them.
    nonisolated static func isFollowing(offset: CGFloat, pane: CGFloat, reading: CGFloat) -> Bool {
        offset + pane >= reading - slack
    }

    /// How much the agent has SAID since the reader left the end of the reading.
    ///
    /// Messages and nothing else: a long stretch of work with no prose counts zero and leaves the
    /// control bare, deliberately — the reading is still visibly detached, but nothing was said.
    ///
    /// `since` is the last row present when following broke, held as a row id rather than an index
    /// (#476). An id this reading does not hold counts nothing — degrade-down: a place that is not
    /// in the record is not a place prose can be counted from.
    nonisolated static func newMessages(in rows: [FeedRow], since: FeedRow.ID) -> Int {
        guard let left = rows.firstIndex(where: { $0.id == since }) else { return 0 }
        return rows[rows.index(after: left)...].count(where: \.kind.isMessage)
    }
}
