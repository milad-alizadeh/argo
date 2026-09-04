import ArgoDesign
import SwiftUI

/// What the plan's pill is measured at, and the list it reveals. These answer to the dock it floats
/// over, never to the window. Sampled from #399's feed anatomy study; the gaps below name steps of
/// `ArgoSpacing`, and what stays a bare number is a measure — a ring, a mark, a readable width.
public enum ArgoPlanPill {
    /// How far the pill floats above the dock. A pill flush to the separator would read as part of
    /// the dock's own row.
    public static let lift: CGFloat = ArgoSpacing.comfortable
    /// Between the pill's ring, its counter and the step it names.
    public static let gap: CGFloat = ArgoSpacing.base
    public static let insetX: CGFloat = ArgoSpacing.comfortable
    public static let insetY: CGFloat = ArgoSpacing.snug

    /// The lane the pill occupies over the feed's bottom edge — one line plus the insets, and the
    /// height anything ELSE floating over that edge has to clear. Derived, not sampled: the pill
    /// sizes to its words, so a float measured against a fixed guess would sit on top of it.
    public static var laneHeight: CGFloat {
        insetY * 2 + ArgoFeedRow.lineHeight
    }

    /// The room the pill asks of the edge it floats over — its lane, plus the lift under it.
    /// Derived for `laneHeight`'s reason: the rows below have to be given exactly what the pill
    /// takes, and a fixed guess drifts from it the moment the type does (#1225).
    public static var footprint: CGFloat {
        lift + laneHeight
    }

    /// The ring that carries how far the plan has got. Larger than a status dot: it says a
    /// fraction, which needs an arc long enough to read as one.
    public static let ringSize: CGFloat = 12

    /// How wide the revealed list runs. A fixed measure rather than a fit, so the popover cannot
    /// resize per entry and move under the pointer that opened it.
    public static let listWidth: CGFloat = 320
    /// Between the pill and the list standing over it.
    public static let listGap: CGFloat = ArgoSpacing.base
    public static let listInsetX: CGFloat = ArgoSpacing.loose
    public static let listInsetY: CGFloat = ArgoSpacing.comfortable
    /// Between two steps in it. The tightest step in the contract: the list is one thing.
    public static let betweenSteps: CGFloat = ArgoSpacing.hair
    /// The column a step's mark is drawn in, so a run of them sets its words on one vertical
    /// whatever each step's status is.
    public static let markWidth: CGFloat = 12
    /// The longest a step's words run in the LIST before they are cut; the pill's own line takes
    /// one.
    public static let stepLines = 2
}
