import ArgoUI
import SwiftUI

/// The deck mid-drag: the reading still drawn across the width it was MEASURED at, inside a pane
/// the reader has since narrowed (ADR-0030, Rule 6).
///
/// This is the one state of the resize that a still can make a claim about. What has to be judged
/// is that the rows are intact and simply cut off at the pane's edge — no half-wrapped prose, no
/// row overlapping the one below it, no reflow under heights that are not allowed to follow the
/// width. A drag that reflowed would show the same rows re-wrapped at the narrow measure with the
/// wide measure's heights around them, which is the tear this lane exists to stop.
///
/// The clip is STAGED — the reading is given a width and a narrower box clips it, and no drag and
/// no `FeedTableView.isFrozen` are involved. What that buys is a still: the app's own frozen state
/// lasts exactly as long as a hand is on an edge, which is not a thing a render can catch. It is
/// the same picture by construction, because the freeze is a table drawn wider than the pane that
/// shows it — but nothing here exercises the freeze, and the suite is where that claim is made
/// (`FeedResizeFreezeTests`).
struct FrozenResizeSpecimen: View {
    /// The width the reading was measured across — the pane the reader started the drag from,
    /// wide enough that the deck's reading column is at its full measure in it.
    static let measured: CGFloat = 760

    /// The width the drag has reached. Written down rather than taken off the window, because the
    /// cut is only a cut where the pane has come in past the column: a still sized to whatever
    /// window the harness happens to open would show a column with room to spare and no claim in
    /// it at all.
    static let dragged: CGFloat = 560

    var body: some View {
        SpecimenScene.sessions(FeedProjection.longRows, held: FeedProjection.longHeldRowID)
            .frame(width: Self.measured)
            .frame(width: Self.dragged, alignment: .leading)
            .clipped()
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .argoDeckSurface()
    }
}
