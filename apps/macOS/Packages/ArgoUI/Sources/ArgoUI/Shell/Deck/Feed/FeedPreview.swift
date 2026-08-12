import SwiftUI

/// The feed with the state the deck normally owns, for the surfaces that draw it alone.
///
/// `FeedView` deliberately owns none of what a row opens — the panel resizes the column, the
/// lightbox covers the deck, and focus has to be able to come back out of both. That makes it
/// unpreviewable on its own, and a preview that handed it three constants would be looking at a
/// feed where nothing opens. This holds the real state instead, so a `#Preview` exercises the same
/// paths the shell does.
struct FeedPreview: View {
    let rows: [FeedRow]

    /// Whether the overview lane is drawn beside the reading, as the deck draws it. Off by default:
    /// most of these previews are looking at a row, and a lane beside one is a second thing to
    /// read.
    var showsOverview = false

    /// Which row the reading opens held at — as though the reader had scrolled up to it. The only
    /// way to a detached reading in a still, and the only way to put the lane's viewport rectangle
    /// anywhere but at the foot of the lane.
    var held: FeedRow.ID?

    /// Which row's evidence the preview opens on. A settable initial state for the same reason
    /// `SessionsDeck` takes one: the state belongs to the surface, and there is no other way to
    /// reach it without a click.
    @State var open: FeedRow.ID?
    @State private var step: Int?
    @State private var lit: FeedShot?
    @FocusState private var focus: FeedFocus?
    /// The one handle both surfaces hold — see `FeedTableHandle`.
    @State private var table = FeedTableHandle()

    var body: some View {
        // The lane is a share of what it and the feed have between them, so the preview has to be
        // measured like the deck rather than given a number.
        GeometryReader { proxy in
            HStack(spacing: ArgoSpacing.flush) {
                FeedView(
                    rows: rows,
                    selection: FeedRowSelection(open: $open, step: $step, lit: $lit, focus: $focus),
                    held: held,
                    table: table,
                )
                if showsOverview {
                    DeckSeparator()
                    MinimapLane(feed: table)
                        .frame(width: ArgoLayout.minimapLaneWidth(sharing: proxy.size.width))
                }
            }
        }
        .argoDeckSurface()
        .argoAppearance()
    }
}
