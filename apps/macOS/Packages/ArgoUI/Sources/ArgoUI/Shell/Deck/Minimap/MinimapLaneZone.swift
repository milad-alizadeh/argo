import SwiftUI

/// The lane's column beside the reading: the overview lane where a settled document stands under
/// the feed, and the space it will take where one does not.
///
/// The lane is ABSENT while the document is being measured, never approximate (ADR-0030, Rule 7).
/// A lane fed a document nobody has measured draws its marks at positions the pass is about to
/// replace — and after a Session switch it goes on drawing the map of the reading that left.
///
/// Its column stays either way, which is the half that is not obvious. The lane's width is taken
/// out of what the feed is drawn across, so a lane that came and went with the document would
/// change the width its own rows were measured at, and the landing that brought it would owe
/// another whole-document pass.
///
/// The hairline before it is drawn either way, for the same reason the column is held: it is a
/// point of the deck's own width, and a rule that came and went with the document would move the
/// measure the rows were wrapped at.
///
/// One view for both the deck and the specimen library, so the two cannot come to show different
/// states of one reading.
package struct MinimapLaneZone: View {
    let feed: FeedTableHandle
    /// The lane's share of what it and the reading have between them — `DeckZoning.laneWidth`.
    let width: CGFloat
    /// Which Turn a still is naming, passed through to the lane — see `MinimapLane.naming`.
    var naming: MinimapNaming = .nothing

    package var body: some View {
        Group {
            if feed.isSettled {
                MinimapLane(feed: feed, naming: naming)
            } else {
                Color.clear
            }
        }
        .frame(width: width)
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(feed: FeedTableHandle, width: CGFloat, naming: MinimapNaming = .nothing) {
        self.feed = feed
        self.width = width
        self.naming = naming
    }
}
