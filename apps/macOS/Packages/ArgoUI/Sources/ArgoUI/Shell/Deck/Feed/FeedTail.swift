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
    static let slack: CGFloat = ArgoSpacing.base

    /// Whether the reading is still following the Session.
    ///
    /// There are only two honest things to do about a transcript growing under the reader: follow
    /// the newest line, or hold the page they scrolled to. Which is right is not a setting — it is
    /// where they are. Someone at the bottom is watching; someone who scrolled up is reading, and
    /// moving that page under them loses the line they were on.
    static func isFollowing(offset: CGFloat, pane: CGFloat, reading: CGFloat) -> Bool {
        offset + pane >= reading - slack
    }

    var body: some View {
        Color.clear
            .frame(height: ArgoSpacing.section)
            .id(Anchor.tail)
            .accessibilityHidden(true)
    }
}
