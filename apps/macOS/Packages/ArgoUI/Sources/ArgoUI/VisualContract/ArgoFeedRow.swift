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
    /// Between two calls in a row. Tighter than `gap`, which is the step between one thing the
    /// agent produced and the next: a run of calls is one piece of work, and spacing them like
    /// paragraphs breaks it into unrelated events.
    public static let callStep: CGFloat = ArgoSpacing.tight
    /// Between the parts of a call's own sentence — its mark, its verb, what it named.
    public static let callGap: CGFloat = ArgoSpacing.snug
    /// Between two blocks of one message — a heading and the paragraph under it, two paragraphs, a
    /// list and the prose after it. Tighter than `gap`, which separates two things the agent
    /// produced: everything inside one message is one thing.
    public static let blockStep: CGFloat = ArgoSpacing.comfortable
    /// Between a list item's marker and its words.
    public static let markerGap: CGFloat = ArgoSpacing.snug
    /// The column a list marker is drawn in, so a run of items sets its words on one vertical
    /// whether they are bullets or numbers.
    public static let markerWidth: CGFloat = 18

    /// The column a call's mark is drawn in. Fixed, so every verb in a run of calls starts on one
    /// vertical — the only alignment in the feed, and the reason it does not become a table.
    public static let callSymbolWidth: CGFloat = 15

    /// The rung the feed's BODY is set on — its prose and its call lines alike.
    ///
    /// One rung and not two. The column was set a step over the shell's density on the argument
    /// that it is read from start to finish, which left a paragraph at `title3` sitting directly
    /// above a call line at `body`: two sizes in one column, and the reader is asked to take the
    /// larger one as more important when it is only prose. What separates a paragraph from a call
    /// here is its ink, its measure and its shape — never its size. Markup keeps its own steps: a
    /// heading is a heading because the agent wrote one.
    public static let proseRung: ArgoTypeScale = .body

    /// The line height the body is set at. Open for its size on purpose: a feed is read, not
    /// scanned, and the rest of the cockpit's density does not apply inside the column.
    public static let lineHeight: CGFloat = 20

    /// The gutter a patch's line numbers sit in, inside the evidence panel. Wide enough for four
    /// digits, which is where a file stops being one anybody scrolls.
    public static let diffGutterWidth: CGFloat = 32

    /// The widest a PROMPT BUBBLE may run.
    ///
    /// It used to cap the feed's prose as well, and no longer does: a paragraph stopping short
    /// while the call lines beneath it ran the full column read as a block that had failed to lay
    /// out rather than as a measure, because the thing it is measured against was right there
    /// beside it. The column is the measure for prose now, and the reader sets it with the seam.
    ///
    /// A bubble still needs a bound — it is somebody speaking INTO the session, and one that fills
    /// the column stops looking like it — so the number survives for the one thing it still holds.
    public static let measure: CGFloat = 480
    /// The share of that a prompt's bubble may take. Under half would read as a caption; the whole
    /// of it would stop reading as somebody speaking into the session.
    public static let bubbleShare: CGFloat = 0.62
    /// How much of a long prompt stands before it is folded — enough to recognise what was asked,
    /// short enough that one prompt cannot push a turn's whole answer off the screen.
    public static let collapsedPromptLines = 6
    /// How much taller than its folded self a prompt must measure before anything is claimed to be
    /// hidden. Layout answers in fractions of a point, and a fold offered over rounding noise is a
    /// control that does nothing.
    public static let foldTolerance: CGFloat = 1

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
        max(0, lineHeight - ArgoFeedRow.proseRung.size * naturalLineHeightRatio)
    }

    /// The same rhythm for machine output. Tighter than prose because a terminal stream is scanned
    /// rather than read, and its own lines already carry the structure that leading gives prose.
    public static var machineLineSpacing: CGFloat {
        max(0, machineLineHeight - ArgoTypography.machine.size * naturalLineHeightRatio)
    }

    /// What a line of output is set at, inside the evidence panel.
    static let machineLineHeight: CGFloat = 18
}
