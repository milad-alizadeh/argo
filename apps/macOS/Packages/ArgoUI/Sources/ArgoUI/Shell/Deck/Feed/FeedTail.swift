import SwiftUI

/// The end of the reading: the gutter under the last row, and the place a scroll aims at.
///
/// A view rather than a number, because it is both of those things at once. The inset under the
/// last row has to exist either way, and giving it an identity is what lets "back to the newest
/// line" mean the end of the CONTENT rather than the top of the last row — a scroll that stopped
/// at the row would leave the feed permanently one gutter short of the bottom it is aiming at.
struct FeedTail: View {
    /// What the scroller asks for. Named rather than positional, so nothing has to know how many
    /// rows there are in order to ask for the end.
    enum Anchor: Hashable {
        case tail
    }

    /// How far short of the end still counts as the end.
    ///
    /// Layout answers in fractions of a point and a settled scroll lands a hair short of its own
    /// end, so an exact test would drop the reader out of following at the moment they arrive. A
    /// tolerance and not a screenful: one row up is a reader who has scrolled.
    nonisolated static let slack: CGFloat = ArgoSpacing.base

    /// How long a scroll to the end is given to settle before it is aimed again.
    ///
    /// Not a motion token: nothing about this is on screen. It is a wait for the LAYOUT — the rows
    /// a scroll to the end realises on its way there replace their own estimated heights, and the
    /// end moves as they do. One frame at 60Hz is 16ms and one at 120 is 8; this is several of
    /// either, which is a settled layout rather than a race with one.
    nonisolated static let settlingPass = Duration.milliseconds(80)

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

    /// Whether this scroll phase is the reader moving the reading, rather than the feed moving it
    /// for them.
    ///
    /// `follow()` scrolls to the end against heights the lazy stack has only estimated, so it
    /// routinely lands a hair short; a latch that read its own landing would conclude the reader
    /// had left the end and offer them the way back to where they already are — permanently.
    ///
    /// The quieter answer wins twice over. An unrecognised phase reads as not the reader's, and a
    /// device that reports NO phase — a discrete wheel raises no gesture — reads as not the reader
    /// either. Neither can be the only witness, which is why `FeedView` also watches the content
    /// height: a reading that did not grow was not moved by the Session.
    nonisolated static func isReaderDriven(_ phase: ScrollPhase) -> Bool {
        switch phase {
        case .tracking, .interacting, .decelerating: true
        case .idle, .animating: false
        @unknown default: false
        }
    }

    /// Whether the composer floats over this reading. The gutter is part of the content, so
    /// growing it here is what keeps every scroll target and follow reading honest: the newest
    /// line sits clear of the vessel because the end of the reading genuinely is below it.
    var isUnderComposer = false

    var body: some View {
        Color.clear
            .frame(
                height: isUnderComposer ? ArgoComposerVessel.feedClearance : ArgoSpacing.section,
            )
            .id(Anchor.tail)
            .accessibilityHidden(true)
    }
}
