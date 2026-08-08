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

    /// How wide one shot in a gallery is drawn. Large rather than a filename-sized chip: the
    /// whole reason a picture is in the feed is that it can be recognised without being opened,
    /// and four of these across the measure is what a row of screenshots wants.
    public static let shotWidth: CGFloat = 168
    /// How tall its picture is. Fixed, so a row of shots at different aspect ratios sets its
    /// captions on ONE baseline instead of a ragged one.
    public static let shotHeight: CGFloat = 112
    /// Between two shots in a gallery. Tighter than the step between rows: a run of shots is one
    /// piece of looking, exactly as a run of calls is.
    public static let shotGap: CGFloat = ArgoSpacing.base
    /// The mount a RENDERED artifact sits on — the inset that keeps it from bleeding to its own
    /// edges, which is what a captured screen does and a drawn artifact does not.
    public static let shotMount: CGFloat = ArgoSpacing.snug
    /// The margin the lightbox leaves around a picture shown full size, so an image that fills
    /// the deck still reads as something laid over it rather than as a new screen.
    public static let lightboxInset: CGFloat = ArgoSpacing.region

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

    /// How far the way-back-to-the-newest control floats above the bottom of the feed. Clear of
    /// the last row it would otherwise sit on, and clear of the plan pill, which floats over the
    /// same edge on the other side of the column.
    public static let tailLift: CGFloat = ArgoSpacing.loose

    /// How thick a drawn rule inside a block of prose is — a table's own gridlines. One point,
    /// because it is a boundary and not a border: it says where a cell ends and never competes
    /// with the words. A WIDTH; the ink it is drawn in is `edge.hairline`.
    public static let ruleWidth: CGFloat = 1

    /// The widest the feed's content runs, however wide the deck is.
    ///
    /// A measure for the WHOLE column and not for one row in it. Prose was once capped on its own
    /// while the call lines beneath it ran the full width, which read as a paragraph that had
    /// failed to lay out — the fix is not to unbind the prose but to bind everything, so the
    /// measure is a property of the reading rather than of one kind of row. Centred in the zone, so
    /// the deck grows and the line length does not.
    public static let column: CGFloat = 720

    /// The share of the COLUMN a prompt's bubble may take, as a ceiling — a short prompt still
    /// sizes to its own words. Under half would read as a caption; the whole of it would stop
    /// reading as somebody speaking into the session.
    public static let bubbleShare: CGFloat = 0.78
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

public extension View {
    /// The feed's measure, applied. The pair is ONE rule and not two — cap the content, then
    /// centre the capped block in whatever it was given — and a surface that spelled only the
    /// first half would read as a column stuck to the left edge of a wide deck.
    func argoFeedMeasure() -> some View {
        frame(maxWidth: ArgoFeedRow.column, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .center)
    }
}
