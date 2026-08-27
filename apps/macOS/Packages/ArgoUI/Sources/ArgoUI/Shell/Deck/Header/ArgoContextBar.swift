import SwiftUI

/// What the session header's context instrument is measured at — the bar on the tab line and the
/// ⓘ panel it opens. Content MEASURES throughout: a gauge thin enough to read as one, and columns
/// sized to the words that stand in them.
public enum ArgoContextBar {
    /// The context instrument on the tab line's trailing edge. Fixed, not a share of the line: the
    /// tabs slot beside it is what gives way, and a shrinking instrument would move its two
    /// threshold ticks on every resize.
    public static let instrumentWidth: CGFloat = 200
    /// Thin enough to read as a gauge rather than as a control — nothing here is draggable.
    public static let height: CGFloat = 3
    /// How far a threshold tick stands proud of the bar on each side. Without the overshoot a
    /// hairline inside a 3pt bar is indistinguishable from the fill's own edge.
    public static let tickOvershoot: CGFloat = 2

    /// The ⓘ panel. Wide enough for a sentence at the caption size and no wider.
    public static let guideWidth: CGFloat = 320
    /// The threshold column in that panel, so the two meanings beside it start on one edge.
    public static let guideThresholdWidth: CGFloat = 74
    /// The term column in the same panel's `This Session` block, so the readings stay on one edge
    /// whichever facts a Session has. Wider than the threshold column: it holds words.
    public static let guideTermWidth: CGFloat = 96
}
