import SwiftUI

/// The feed's own rhythm: what one row of a Session's reading is measured at.
///
/// A group of its own rather than four more constants in `ArgoLayout`, because these are not
/// structural proportions of the shell — they are the typographic measure of a column of prose,
/// and they answer to legibility rather than to the window. Sampled from the approved anatomy
/// study (`docs/designs/cockpit-feed-anatomy-prototype-399.html`), which is the only source that
/// carries numbers; the decision log carries none.
public enum ArgoFeedRow {
    /// The gutter each row is inset from the feed column's edges.
    public static let inset: CGFloat = ArgoSpacing.section
    /// Between one row and the next.
    public static let gap: CGFloat = ArgoSpacing.loose
    /// Between a row's label and the prose under it — the tightest step in the contract, so the
    /// two read as one block rather than as two rows.
    public static let stepBeforeProse: CGFloat = ArgoSpacing.hair
    /// The line height prose is set at. Open for its size on purpose: a feed is read, not
    /// scanned, and the rest of the cockpit's density does not apply inside the column.
    public static let lineHeight: CGFloat = 21

    /// The widest a line of prose may run, whatever the deck is doing.
    ///
    /// A measure, not a layout: past roughly 75 characters the eye loses the line it is returning
    /// to, so a wide window gets more feed, never a longer line. Worth about 74 characters of the
    /// body role — the study's own measure, converted from `ch` at the same size.
    public static let measure: CGFloat = 540
    /// The share of the measure a prompt's bubble may take. Under half the column would read as a
    /// caption; the whole of it would stop reading as somebody speaking into the session.
    public static let bubbleShare: CGFloat = 0.62
    /// How much of a long prompt stands before it is folded — enough to recognise what was asked,
    /// short enough that one prompt cannot push a turn's whole answer off the screen.
    public static let collapsedPromptLines = 6

    /// What the system already sets a line at, as a multiple of its point size.
    ///
    /// SwiftUI has no line-height modifier — `lineSpacing` is the EXTRA leading on top of the
    /// font's own — so the contract's `lineHeight` is spent through this rather than handed to a
    /// view that would have to do the subtraction itself.
    static let naturalLineHeightRatio: CGFloat = 1.21

    public static var bubbleMeasure: CGFloat {
        measure * bubbleShare
    }

    /// The extra leading that puts the body role on `lineHeight`. Floored at zero: a line height
    /// under the font's own is not something leading can express, and a negative one would tighten
    /// the very rhythm this exists to open.
    public static var proseLineSpacing: CGFloat {
        max(0, lineHeight - ArgoTypography.body.size * naturalLineHeightRatio)
    }
}
