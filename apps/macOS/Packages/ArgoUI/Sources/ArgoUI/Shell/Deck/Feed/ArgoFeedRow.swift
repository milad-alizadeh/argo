import SwiftUI

/// What one feed row is measured at. Every GAP names a step of `ArgoSpacing`; a bare number is a
/// content MEASURE and carries its reason here.
public enum ArgoFeedRow {
    /// The gutter each row is inset from the feed column's edges.
    public static let inset: CGFloat = ArgoSpacing.section
    /// Between one row and the next.
    public static let gap: CGFloat = ArgoSpacing.loose
    /// Between a row's label and the prose under it — the tightest step in the contract.
    public static let stepBeforeProse: CGFloat = ArgoSpacing.hair
    /// Between two calls in a row. Tighter than `gap`: a run of calls is one piece of work.
    public static let callStep: CGFloat = ArgoSpacing.tight
    /// Between the parts of a call's own sentence — its mark, its verb, what it named.
    public static let callGap: CGFloat = ArgoSpacing.snug
    /// Between two blocks of one message. Tighter than `gap`.
    public static let blockStep: CGFloat = ArgoSpacing.comfortable
    /// Between a list item's marker and its words.
    public static let markerGap: CGFloat = ArgoSpacing.snug
    /// The column a list marker is drawn in — fixed, so bullets and numbers set words on one
    /// vertical.
    public static let markerWidth: CGFloat = 18

    /// The column a call's mark is drawn in. Fixed, so every verb in a run starts on one vertical.
    public static let callSymbolWidth: CGFloat = 15

    /// How far a marked span's ground is pushed past its glyphs. Asymmetric: the line box already
    /// stands clear vertically, so more would have consecutive lines of a paragraph touching.
    public static let markedSpanInsetX: CGFloat = 3
    public static let markedSpanInsetY: CGFloat = 1

    /// How wide one shot in a gallery is drawn — four across the measure.
    public static let shotWidth: CGFloat = 168
    /// How tall its picture is. Fixed, so shots at different aspect ratios caption on ONE baseline.
    public static let shotHeight: CGFloat = 112
    /// The box one shot's picture is drawn in, and so the size its bytes are decoded to — a
    /// gallery draws hundreds of these and a lightbox one, which is the whole difference in what a
    /// long session costs to hold (#962).
    static let shotPlate = CGSize(width: shotWidth, height: shotHeight)
    /// Between two shots in a gallery. Tighter than the step between rows.
    public static let shotGap: CGFloat = ArgoSpacing.base
    /// Above and below a gallery run, on top of the feed's own step.
    public static let shotBreath: CGFloat = ArgoSpacing.base
    /// The mount a RENDERED artifact sits on — the inset that keeps it off its own edges.
    public static let shotMount: CGFloat = ArgoSpacing.snug
    /// The margin the lightbox leaves around a picture shown full size.
    public static let lightboxInset: CGFloat = ArgoSpacing.region

    /// The square a Turn's copy chip is drawn in (#767) — a hit target a glyph this quiet still
    /// answers to.
    public static let copyChipSide: CGFloat = 24

    /// Between the last line of a Turn's messages and the chip under it. Tighter than `gap`.
    public static let copyChipStep: CGFloat = ArgoSpacing.tight

    /// The rung the feed's BODY is set on — prose and call lines alike. Markup keeps its own steps.
    public static let proseRung: ArgoTypeScale = .body

    /// The line height the body is set at.
    public static let lineHeight: CGFloat = 20

    /// The gutter a patch's line numbers sit in. Wide enough for four digits.
    public static let diffGutterWidth: CGFloat = 32

    /// How far the way-back-to-the-newest control floats above the bottom of the feed. Stacked
    /// above the plan pill's lane, not beside it: side by side, a narrow deck draws the centred
    /// pill and the trailing capsule on top of each other.
    public static var tailLift: CGFloat {
        ArgoPlanPill.lift + ArgoPlanPill.laneHeight + ArgoSpacing.base
    }

    /// How wide that control is drawn — the pill's own lane; the diameter is the whole hit area.
    public static var tailDiameter: CGFloat {
        ArgoPlanPill.laneHeight
    }

    /// How thick a drawn rule inside prose is — a table's gridlines. A WIDTH; the ink is
    /// `edge.hairline`.
    public static let ruleWidth: CGFloat = 1

    /// The breathing room inside one cell of a pipe table. Named here because a column's ask is its
    /// widest cell's words PLUS this, and that arithmetic happens away from the view.
    public static let tableCellInsetX: CGFloat = ArgoSpacing.base
    public static let tableCellInsetY: CGFloat = ArgoSpacing.snug

    /// The breathing room inside the card a question is drawn on, and the column its chosen mark
    /// sits in. Named here for the same reason the bubble's and the table cell's are: the overview
    /// lane lays the card out again, and two views picking the same step by hand is how they drift.
    public static let askCardInset: CGFloat = ArgoSpacing.comfortable
    public static let askOptionGap: CGFloat = ArgoSpacing.tight

    /// The widest the feed's content runs — the whole column, not one row. Centred in the zone, so
    /// the deck grows and the line length does not.
    public static let column: CGFloat = 720

    /// The share of the COLUMN a prompt's bubble may take, as a ceiling.
    public static let bubbleShare: CGFloat = 0.78

    /// The words' own measure inside that bubble, at a feed column of `measure`: the ceiling less
    /// the bubble's own insets. Named here because the bubble's layout, the overview lane that
    /// draws its miniature and the suite holding the two together must all ask at ONE number — the
    /// arithmetic spelled out three times is how a bubble and its map come to wrap differently.
    public static func bubbleInside(of measure: CGFloat) -> CGFloat {
        max(0, measure * bubbleShare - bubbleInsetX * 2)
    }

    /// The breathing room inside a bubble, above and below its words. Named here and not in the
    /// view because the overview lane subtracts it: a bubble's ground is spacing, and a lane that
    /// divided the whole row height by the line height drew a one-line prompt as two.
    public static let bubbleInsetY: CGFloat = ArgoSpacing.comfortable
    /// The same at its leading and trailing edges.
    public static let bubbleInsetX: CGFloat = ArgoSpacing.loose

    /// The share of the COLUMN the working thread's filament runs. A share and not a length, so the
    /// ion tracks `column` the way a bubble does instead of freezing at one window's width.
    public static let workingThreadShare: CGFloat = 0.3
    /// Where that filament starts and ends, in multiples of its OWN length. Both bounds are clear
    /// of the lane, so it fades in and out at the measure's edges rather than appearing mid-air.
    public static let workingThreadTravel: ClosedRange<CGFloat> = -1.05 ... 3.4
    /// How brightly it glows parked, with movement off. Below `ArgoElevation.bloom` because a still
    /// has no travel to read the ion by, and at that strength it would read as a drawn rule.
    public static let workingThreadStillGlow: Double = 0.4
    /// How much of a long prompt stands before it is folded.
    public static let collapsedPromptLines = 6

    /// The extra leading that puts the body role on `lineHeight`. Floored at zero: a line height
    /// under the font's own is not something leading can express.
    ///
    /// Both of these take the NOMINAL box off, and `ProseFace.step` adds them to the drawn one, so
    /// neither line lands on the height its name promises — prose by a point and a half, the mono
    /// by nearly three because `ArgoTypography.machine`'s rung is not the rung the feed draws its
    /// mono at either. Left alone here on purpose: correcting them re-spaces every line of the
    /// feed, which the design has to see rather than take as a rider on #766's family — #1026.
    public static var proseLineSpacing: CGFloat {
        max(0, lineHeight - proseRung.size * ArgoTypeScale.naturalLineHeightRatio)
    }

    /// The same rhythm for machine output. Tighter than prose.
    public static var machineLineSpacing: CGFloat {
        max(0, machineLineHeight - ArgoTypography.machine.lineBox)
    }

    /// What a line of output is set at, inside the evidence panel.
    static let machineLineHeight: CGFloat = 18
}

public extension View {
    /// The feed's measure, applied. The pair is ONE rule: cap the content, then centre the cap.
    func argoFeedMeasure() -> some View {
        frame(maxWidth: ArgoFeedRow.column, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .center)
    }
}
