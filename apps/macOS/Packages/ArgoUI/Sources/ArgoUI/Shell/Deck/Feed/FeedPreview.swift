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

    /// Which row's evidence the preview opens on. A settable initial state for the same reason
    /// `SessionsDeck` takes one: the state belongs to the surface, and there is no other way to
    /// reach it without a click.
    @State var open: FeedRow.ID?
    @State private var step: Int?
    @State private var lit: FeedShot?
    @FocusState private var focus: FeedFocus?

    var body: some View {
        FeedView(
            rows: rows,
            selection: FeedRowSelection(open: $open, step: $step, lit: $lit, focus: $focus),
        )
        .argoDeckSurface()
        .argoAppearance()
    }
}
