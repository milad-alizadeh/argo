import SwiftUI

/// What the plan's pill is measured at, and the list it reveals.
///
/// Its own group rather than four more constants in `ArgoLayout`, for the reason `ArgoFeedRow` is:
/// these are not structural proportions of the shell. The pill is a thing that FLOATS over one, so
/// what it answers to is how far it stands off the dock and how wide a list stays readable — never
/// the window. Sampled from the approved anatomy study
/// (`docs/designs/cockpit-feed-anatomy-prototype-399.html`), the only source carrying numbers.
public enum ArgoPlanPill {
    /// How far the pill floats above the dock. The whole claim of the surface is that it is over
    /// the deck rather than in it, and a pill flush to the separator would read as part of the
    /// dock's own row.
    public static let lift: CGFloat = ArgoSpacing.comfortable
    /// Between the pill's ring, its counter and the step it names.
    public static let gap: CGFloat = ArgoSpacing.base
    public static let insetX: CGFloat = ArgoSpacing.comfortable
    public static let insetY: CGFloat = ArgoSpacing.snug

    /// The lane the pill occupies over the feed's bottom edge — its own line plus the insets
    /// either side of it, and the height anything ELSE floating over that edge has to clear.
    ///
    /// Derived rather than sampled, because the pill sizes to its words: what is fixed is the one
    /// line it is allowed and the inset around it, and a second float measured against a guess
    /// would sit on top of the plan the first time a step's wording changed.
    public static var laneHeight: CGFloat {
        insetY * 2 + ArgoFeedRow.lineHeight
    }

    /// The ring that carries how far the plan has got. Larger than a status dot on purpose: a dot
    /// says one thing and this says a fraction, which needs an arc long enough to read as one.
    public static let ringSize: CGFloat = 12

    /// How wide the revealed list runs. A measure rather than a fit: a plan of four short steps
    /// and a plan of four long ones should open the same panel, and a popover that resized itself
    /// per entry would move under the pointer that opened it.
    public static let listWidth: CGFloat = 320
    /// Between the pill and the list standing over it.
    public static let listGap: CGFloat = ArgoSpacing.base
    public static let listInsetX: CGFloat = ArgoSpacing.loose
    public static let listInsetY: CGFloat = ArgoSpacing.comfortable
    /// Between two steps in it. The tightest step in the contract — the list is one thing, and
    /// spacing its entries like paragraphs would break a plan into unrelated notes.
    public static let betweenSteps: CGFloat = ArgoSpacing.hair
    /// The column a step's mark is drawn in, so a run of them sets its words on one vertical
    /// whatever each step's status is.
    public static let markWidth: CGFloat = 12
    /// The longest a step's words run before they are cut. Two lines rather than one: a to-do an
    /// agent wrote is a sentence, and a list truncating every entry mid-clause is a list nobody
    /// can read. The pill's own line takes one — it names the current step, and a pill two lines
    /// deep stops being a pill.
    public static let stepLines = 2
}
