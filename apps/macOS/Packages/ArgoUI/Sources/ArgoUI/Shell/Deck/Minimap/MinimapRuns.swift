import Foundation

/// A row's shape turned into the runs that draw it (#382).
///
/// Called for the rows inside the lane's band and for no others, so its cost is bounded by the
/// lane's height rather than by the session's length.
///
/// Nothing here decides WHERE a row sits: the line count is the caller's, taken off the row's
/// measured height. A lane that wrapped the text for itself would draw a bar the reading has no
/// line for, which is the one thing the miniature may not do.
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
            return fills(of: length, over: lines).enumerated().map { line, fill in
                MinimapRun(ink: ink, line: line, span: span(0, fill))
            }
        case let .bubble(length):
            let width = min(ArgoFeedRow.bubbleShare, fill(of: length, across: measure))
            return [MinimapRun(ink: .prompt, line: 0, lines: lines, span: span(1 - width, 1))]
        case let .sentence(length, ink):
            return [MinimapRun(ink: ink, line: 0, span: span(0, fill(of: length, across: measure)))]
        case let .change(length, added, removed):
            return change(fill(of: length, across: measure), added, removed)
        case let .whole(ink):
            return [MinimapRun(ink: ink, line: 0, lines: lines, span: span(0, 1))]
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
    private static func span(_ from: CGFloat, _ to: CGFloat) -> ClosedRange<CGFloat> {
        let low = min(max(0, from), 1)
        let high = min(max(0, to), 1)
        return min(low, high) ... max(low, high)
    }

    /// How many characters a line of the feed's prose holds across a measure. SF Pro's average
    /// advance is close to half its point size, which is the one number that turns a character
    /// count into a width — and it only ever decides how RAGGED a bar is, never where it sits.
    private static func charactersPerLine(across measure: CGFloat) -> Int {
        guard measure > 0 else { return 0 }
        return Int(measure / (ArgoFeedRow.proseRung.size * ArgoMinimapLane.characterAdvanceShare))
    }
}
