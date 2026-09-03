import ArgoDesign
import SwiftUI

/// What the overview lane beside the reading is measured at (D25). Per-surface measures rather than
/// rungs of the rhythm: how tall a rect may stand is a property of the lane's compression, not of
/// the deck's spacing. The lane's own width is `ArgoLayout.minimapLaneWidth(sharing:)`.
public enum ArgoMinimapLane {
    /// How far the rects stand off each edge, so the miniature reads as a column of events rather
    /// than as ink run to the deck's boundary.
    public static let rectInset: CGFloat = ArgoSpacing.comfortable

    /// The floor under one rect. At a real session's length a row compresses below a point, and a
    /// rect nobody can see maps nothing. One point and no more, because the floor is also what
    /// merges neighbours: a thousand rows held at two would fill the lane with solid ink.
    ///
    /// A point rather than a pixel, which is what makes it D25's two: the lane is only ever drawn
    /// on a Retina display, so one point of it is two pixels tall.
    public static let rectMinimumHeight: CGFloat = 1

    /// The gap held between two rects, so a run of rows reads as separate events.
    public static let rectGap: CGFloat = 1

    /// How present one run of the miniature is. The lane is read at a glance BESIDE the reading and
    /// never instead of it, so the shapes sit well under the words they stand for — and at this
    /// rung a dense lane reads as texture rather than as a second wall of content.
    public static let runOpacity: Double = 0.4

    /// The same under Increased Contrast, where a shape has to clear the surface it sits on before
    /// it has to sit under the words. Paired with `runOpacity` rather than replacing it, because
    /// the lane is designed at the quieter of the two.
    public static let runOpacityRaised: Double = 0.85

    /// The Ion Blue line that spans one Turn, down the lane's leading edge — Xcode's per-block
    /// change bar, in the one colour this app spends on nothing but brand, selection and focus.
    /// Two points, because it stands beside the runs rather than among them.
    public static let turnLineWidth: CGFloat = 2
    public static let turnLineInset: CGFloat = 2

    /// How far short of the next Turn one line stops. A block reaches the next block's head so a
    /// hover never falls between two — but two lines drawn end to end are one line, and under ⇧⌘
    /// every Turn on screen is named at once.
    public static let turnLineGap: CGFloat = ArgoSpacing.tight

    /// The rung a Turn's prompt is drawn at when the pointer names it. The smallest rung the HIG
    /// gives a label, and the label is rasterised at the display's own backing scale and never
    /// scaled after — so this is its size on screen, not a size something later shrinks.
    public static let labelRung: ArgoTypeScale = .caption1

    /// The breathing room inside a label's own ground, which is what lets it be read over what it
    /// covers.
    public static let labelPadding: CGFloat = ArgoSpacing.tight

    /// How far a Turn's label may reach to the leading side of the lane, over the reading. The lane
    /// itself is four or five words wide, and a prompt cut there names no Turn — so the label hangs
    /// outside it. A sentence's worth and no more, because what is under it is the reading.
    public static let labelWidth: CGFloat = 260

    /// How tall one label stands, ground and all. Also the closest two labels may be: under
    /// ⇧⌘ every Turn asks for one at once, and labels drawn on top of each other are none.
    ///
    /// The rung's DRAWN box, because `MinimapLaneView+Annotations` draws these with
    /// `preferredFont(forTextStyle:)`, and this same number is what its ground is filled at, what
    /// its text is inset inside, and how far apart two of them are kept.
    @MainActor public static var labelHeight: CGFloat {
        labelRung.drawnLineBox + labelPadding * 2
    }

    /// The floor under the viewport rectangle. A long reading compresses the visible range to a
    /// hairline, and a rectangle too thin to see is one nobody can grab.
    public static let viewportMinimumHeight: CGFloat = 24

    /// How many wrapped texts one row of the miniature asks for, for the store the paint holds
    /// (`MinimapGeometry.rects(in:)`). Four, over a measured two: the worst reading the design has
    /// is a heading and a paragraph a row — 600 Core Text passes over 300 rows — and a list or a
    /// table asks for more. `ProseCache.cap` is what bounds it whatever this says.
    public static let textsPerRow = 4

    /// How many lane-heights of the miniature are held as pixels at once. Three, so the reader has
    /// a lane-height of slack in either direction before a redraw — and no more, because the band
    /// is what bounds the lane's memory.
    public static let bandLaneHeights: CGFloat = 3
}
