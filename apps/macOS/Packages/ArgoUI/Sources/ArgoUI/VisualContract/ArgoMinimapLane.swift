import SwiftUI

/// What the overview lane beside the reading is measured at (D25). Per-surface measures rather than
/// rungs of the rhythm: how tall a mark may stand is a property of the lane's compression, not of
/// the deck's spacing. The lane's own width is `ArgoLayout.minimapLaneWidth`.
public enum ArgoMinimapLane {
    /// How far the marks stand off each edge, so the miniature reads as a column of events rather
    /// than as ink run to the deck's boundary.
    public static let markInset: CGFloat = ArgoSpacing.comfortable

    /// The floor under one mark. At a real session's length a row compresses below a point, and a
    /// mark nobody can see maps nothing. One point and no more, because the floor is also what
    /// merges neighbours: a thousand rows held at two would fill the lane with solid ink.
    public static let markMinimumHeight: CGFloat = 1

    /// The ceiling over one, and the whole of D25's weight cap: a huge diff, log or gallery may not
    /// consume the overview in proportion to what it holds. A share of the lane rather than a fixed
    /// measure, because the cap is a claim about how much of the OVERVIEW one event may take.
    public static let markMaximumShare: CGFloat = 0.15

    /// The gap held between two marks, so a run of rows reads as separate events.
    public static let markGap: CGFloat = 1

    /// The floor under the viewport rectangle. A long reading compresses the visible range to a
    /// hairline, and a rectangle too thin to see is one nobody can grab.
    public static let viewportMinimumHeight: CGFloat = 24
}
