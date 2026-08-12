import Foundation

/// How full a row's bars are drawn — the arithmetic that makes the lane read as text rather than as
/// a stack of identical blocks (#382).
///
/// Nothing here decides WHERE a row sits: the line count is always the caller's, taken off the
/// row's measured height. A lane that wrapped the text for itself would draw a bar the reading has
/// no line for, which is the one thing the miniature may not do.
enum MinimapRuns {
    /// How full each line of a block is, head to foot. All of them but the last, which is as full
    /// as the characters that were left for it — the ragged edge that says "paragraph".
    static func fills(of characters: Int, over lines: Int) -> [CGFloat] {
        guard lines > 0 else { return [] }
        let perLine = max(1, Int((Double(max(0, characters)) / Double(lines)).rounded(.up)))
        return (0 ..< lines).map { line in
            let landed = min(max(0, characters - line * perLine), perLine)
            return CGFloat(landed) / CGFloat(perLine)
        }
    }

    /// How far one line of text gets across the column it is drawn in. For the rows the feed says
    /// in a single line — a call, a fold, a mark — where the height cannot say how far it ran.
    static func fill(of characters: Int, across measure: CGFloat) -> CGFloat {
        let perLine = charactersPerLine(across: measure)
        guard perLine > 0 else { return 1 }
        return min(1, CGFloat(max(0, characters)) / CGFloat(perLine))
    }

    /// How many lines the row's measured height was drawn as. Rounded rather than truncated: a row
    /// carries the feed's own padding above and below its text, so flooring loses the last line.
    static func lines(inside height: CGFloat) -> Int {
        max(1, Int((height / ArgoFeedRow.lineHeight).rounded()))
    }

    /// Runs laid against the leading edge, one per line — where everything but a prompt sits.
    static func leading(_ fills: [CGFloat], _ ink: MinimapInk) -> [MinimapRun] {
        fills.enumerated().map { line, fill in
            MinimapRun(ink: ink, line: line, span: 0 ... max(0, fill))
        }
    }

    /// How many characters a line of the feed's prose holds across a measure. SF Pro's average
    /// advance is close to half its point size, which is the one number that turns a character
    /// count into a width — and it is only ever used for how RAGGED a bar is, never for where it
    /// is.
    private static func charactersPerLine(across measure: CGFloat) -> Int {
        Int(measure / (ArgoFeedRow.proseRung.size * ArgoMinimapLane.characterAdvanceShare))
    }
}
