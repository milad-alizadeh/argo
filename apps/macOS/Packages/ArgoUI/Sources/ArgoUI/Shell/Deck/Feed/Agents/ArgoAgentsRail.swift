import SwiftUI

/// What the agents rail beside the reading is measured at. How far the rail may be DRAGGED is the
/// deck's business rather than the rail's — that is `ArgoLayout.railLimits(in:)`, which spends the
/// rail against the feed and the overview lane.
public enum ArgoAgentsRail {
    /// Where the rail opens — a starting width, not a fixed one; the seam beside it moves.
    public static let width: CGFloat = 256
    /// The rail collapsed: one state dot per Agent and the padding either side of it, and no room
    /// for a name. Below `ArgoLayout.railWidths.lowerBound` on purpose — collapsing is not
    /// dragging, so the seam's floor does not bound it.
    public static let collapsedWidth: CGFloat = 28
}
