import Foundation

/// A row's shape turned into the runs that draw it (#382). Called for the rows inside the lane's
/// band and for no others, so its cost is bounded by the lane's height.
///
/// Nothing here decides WHERE a row sits: the line count is the caller's, off the row's measured
/// height. A lane that wrapped the text itself would draw a bar the reading has no line for.
enum MinimapRuns {
    /// The runs a shape makes across `lines` of drawn line, over a column `measure` points wide.
    static func runs(
        of shape: MinimapRowShape,
        over lines: Int,
        across measure: CGFloat,
    )
        -> [MinimapRun] {
        switch shape {
        case let .prose(length, ink):
            fills(of: length, over: lines).enumerated().map { line, fill in
                MinimapRun(ink: ink, line: line, span: span(0, fill))
            }
        case let .bubble(length):
            bubble(length, over: lines, across: measure)
        case let .composed(blocks, ink):
            composed(blocks, ink: ink, over: lines, across: measure)
        case let .sentence(length, ink):
            [MinimapRun(ink: ink, line: 0, span: span(0, fill(of: length, across: measure)))]
        case let .change(length, added, removed):
            change(fill(of: length, across: measure), added, removed)
        case let .shots(count):
            shots(count, across: measure)
        case let .whole(ink):
            [MinimapRun(ink: ink, line: 0, lines: lines, span: span(0, 1))]
        }
    }

    /// How many lines of the row were drawn. Floored rather than rounded, so the bars a row makes
    /// always fit inside the space the table measured for it — what is left over is the gap to the
    /// row below, which is why the gaps in the lane are the feed's own spacing rather than a rule.
    static func lines(inside height: CGFloat) -> Int {
        max(1, Int(height / ArgoFeedRow.lineHeight))
    }

    /// How full each line of a block is, head to foot. All of them but the last, which is as full
    /// as the characters left for it — the ragged edge that says "paragraph".
    static func fills(of length: Int, over lines: Int) -> [CGFloat] {
        guard lines > 0 else { return [] }
        let perLine = max(1, Int((Double(max(0, length)) / Double(lines)).rounded(.up)))
        return (0 ..< lines).map { line in
            let landed = min(max(0, length - line * perLine), perLine)
            return CGFloat(landed) / CGFloat(perLine)
        }
    }

    /// How far one line of text gets across the column it is drawn in. For the rows the feed says
    /// in a single line — a call, a fold, a mark — where the height cannot say how far it ran.
    static func fill(of length: Int, across measure: CGFloat) -> CGFloat {
        let perLine = charactersPerLine(across: measure)
        guard perLine > 0 else { return 1 }
        return min(1, CGFloat(max(0, length)) / CGFloat(perLine))
    }

    /// A prompt's lines: one bar per drawn line, anchored where the bubble anchors its text — the
    /// leading edge of a region held against the trailing edge — with the ragged last line running
    /// out toward the trailing edge, so a prompt reads as the words it was rather than as a slab.
    private static func bubble(_ length: Int, over lines: Int, across measure: CGFloat)
        -> [MinimapRun] {
        let width = min(ArgoFeedRow.bubbleShare, fill(of: length, across: measure))
        return fills(of: length, over: lines).enumerated().map { line, fill in
            MinimapRun(ink: .prompt, line: line, span: span(1 - width, 1 - width + fill * width))
        }
    }

    /// A gallery's thumbnails, wrapped across the lane the way `FeedGalleryRow` wraps them across
    /// the column: as many to a line as fit at the contract's shot width, each standing as many
    /// lines of the reading as the shot's own height covers.
    ///
    /// Drawn one frame per shot rather than one over the run, because the count is the whole
    /// question a reader has about a turn that rendered something.
    private static func shots(_ count: Int, across measure: CGFloat) -> [MinimapRun] {
        let column = max(measure, 1)
        let step = ArgoFeedRow.shotWidth + ArgoFeedRow.shotGap
        let columns = max(1, Int((column + ArgoFeedRow.shotGap) / step))
        let tall = max(1, Int((ArgoFeedRow.shotHeight / ArgoFeedRow.lineHeight).rounded()))
        return (0 ..< max(0, count)).map { shot in
            let x = CGFloat(shot % columns) * step / column
            return MinimapRun(
                ink: .media,
                line: shot / columns * tall,
                lines: tall,
                span: span(x, x + ArgoFeedRow.shotWidth / column),
            )
        }
    }

    /// A mutation's line: the sentence, then the two diff inks in proportion to what they did.
    ///
    /// Every bound is clamped and ordered here rather than trusted. The counts come off a patch in
    /// a transcript nothing validated, and a negative one would otherwise build a range whose lower
    /// bound is above its upper — which does not misdraw, it traps.
    private static func change(_ sentence: CGFloat, _ added: Int, _ removed: Int) -> [MinimapRun] {
        let share = ArgoMinimapLane.churnShare
        let head = max(0, min(sentence, 1 - share))
        let total = max(0, added) + max(0, removed)
        let split = total > 0 ? head + share * CGFloat(max(0, added)) / CGFloat(total) : head
        return [
            MinimapRun(ink: .command, line: 0, span: span(0, head)),
            MinimapRun(ink: .added, line: 0, span: span(head, split)),
            MinimapRun(ink: .removed, line: 0, span: span(split, head + share)),
        ]
    }

    /// A span, ordered and held inside the lane. The one place a run's bounds are built.
    static func span(_ from: CGFloat, _ to: CGFloat) -> ClosedRange<CGFloat> {
        let low = min(max(0, from), 1)
        let high = min(max(0, to), 1)
        return min(low, high) ... max(low, high)
    }

    /// How many characters a line of the feed's prose holds across a measure. SF Pro's average
    /// advance is close to half its point size, which is the one number that turns a character
    /// count into a width — and it only ever decides how RAGGED a bar is, never where it sits.
    static func charactersPerLine(across measure: CGFloat) -> Int {
        guard measure > 0 else { return 0 }
        return Int(measure / (ArgoFeedRow.proseRung.size * ArgoMinimapLane.characterAdvanceShare))
    }
}
