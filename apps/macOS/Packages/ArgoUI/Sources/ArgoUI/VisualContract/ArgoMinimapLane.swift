import SwiftUI

/// What the overview lane beside the reading is measured at (D25). Per-surface measures rather than
/// rungs of the rhythm: how tall a mark may stand is a property of the lane's compression, not of
/// the deck's spacing. The lane's own width is `ArgoLayout.minimapLaneWidth(sharing:)`.
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

    /// How present one run of the miniature is. The lane is read at a glance BESIDE the reading and
    /// never instead of it, so the shapes sit well under the words they stand for — and at this
    /// rung a dense lane reads as texture rather than as a second wall of content.
    public static let runOpacity: Double = 0.4

    /// How wide one character of the feed's prose is, as a share of its point size. SF Pro's
    /// average advance is close to half, which is the one number that turns a character count into
    /// a width. It decides only how RAGGED a bar is drawn, never where the bar sits.
    public static let characterAdvanceShare: CGFloat = 0.5

    /// How much of a mutation's line the two diff inks take between them, after the sentence in
    /// front of them — the lane's share of what the row draws as `+n −n`.
    public static let churnShare: CGFloat = 0.18

    /// The Ion Blue line that spans one Turn, down the lane's leading edge — Xcode's per-block
    /// change bar, in the one colour this app spends on nothing but brand, selection and focus.
    /// Two points, because it stands beside the runs rather than among them.
    public static let turnLineWidth: CGFloat = 2
    public static let turnLineInset: CGFloat = 2

    /// The rung a Turn's prompt is drawn at when the pointer names it. The smallest rung the HIG
    /// gives a label, and the label is rasterised at the display's own backing scale and never
    /// scaled after — so this is its size on screen, not a size something later shrinks.
    public static let labelRung: ArgoTypeScale = .caption1

    /// The breathing room inside a label's own ground, which is what lets it be read over the
    /// miniature it covers.
    public static let labelPadding: CGFloat = ArgoSpacing.tight

    /// How tall one label stands, ground and all. Also the closest two labels may be: under
    /// ⇧⌘ every Turn asks for one at once, and labels drawn on top of each other are none.
    public static var labelHeight: CGFloat {
        labelRung.size * ArgoTypeScale.naturalLineHeightRatio + labelPadding * 2
    }

    /// The floor under the viewport rectangle. A long reading compresses the visible range to a
    /// hairline, and a rectangle too thin to see is one nobody can grab.
    public static let viewportMinimumHeight: CGFloat = 24

    /// The scroll knob drawn down the lane's outer edge, where the platform's own overlay scroller
    /// would be if the lane were not standing in front of it. Measured off AppKit's, which is a 7pt
    /// knob held 2pt off the edge it runs down.
    public static let scrollerWidth: CGFloat = 7
    public static let scrollerInset: CGFloat = 2

    /// How many lane-heights of the miniature are held as pixels at once. Three, so the reader has
    /// a lane-height of slack in either direction before a redraw — and no more, because the band
    /// is what bounds the lane's memory.
    public static let bandLaneHeights: CGFloat = 3
}
