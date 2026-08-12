import Foundation

// A prompt as the lane draws it: the bubble's ground against the trailing edge, and the words
// inside it against the ground's own leading edge — the shape `FeedPrompt` draws, at the lane's
// scale.

extension MinimapRuns {
    /// A prompt's lines. Measured where the caller measured them, in which case each fill is a
    /// share of the COLUMN rather than of the bubble: the bubble is as wide as its longest line,
    /// so its ground can only be worked out once every line's width is known.
    static func bubble(
        _ length: Int,
        over lines: Int,
        across measure: CGFloat,
        measured: [CGFloat]?,
    )
        -> [MinimapRun] {
        guard let measured, let widest = measured.max() else {
            return guessed(length, over: lines, across: measure)
        }
        let inset = ArgoFeedRow.bubbleInsetX / max(1, measure)
        let ground = min(ArgoFeedRow.bubbleShare, widest + inset * 2)
        let head = 1 - ground + inset
        return sampled(measured, over: lines).enumerated().map { line, fill in
            MinimapRun(ink: .prompt, line: line, span: span(head, head + fill))
        }
    }

    /// The same shape from the character count alone, for a row the lane compressed past the point
    /// where measuring one could show anything.
    private static func guessed(_ length: Int, over lines: Int, across measure: CGFloat)
        -> [MinimapRun] {
        let width = min(ArgoFeedRow.bubbleShare, fill(of: length, across: measure))
        return fills(of: length, over: lines).enumerated().map { line, fill in
            MinimapRun(ink: .prompt, line: line, span: span(1 - width, 1 - width + fill * width))
        }
    }
}
