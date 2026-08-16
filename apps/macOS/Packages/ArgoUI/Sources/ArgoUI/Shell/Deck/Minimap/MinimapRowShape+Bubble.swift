import Foundation

// A prompt as the lane draws it: the words inside a bubble held against the trailing edge, which is
// the shape `FeedPrompt` draws.
//
// The bubble's ground is as wide as its longest line, so nothing here can be answered a line at a
// time — every line's width has to be known before the first one can be placed.

extension MinimapRowShape {
    /// A prompt's lines, in the row's own coordinates.
    @MainActor static func bubble(_ text: String, isFolded: Bool, across measure: CGFloat)
        -> [MinimapRowMark] {
        let inside = measure * ArgoFeedRow.bubbleShare - ArgoFeedRow.bubbleInsetX * 2
        guard inside > 0 else { return [] }
        let lay = ProseMetrics.lay(out: text, across: inside)
        guard let widest = lay.widths.max() else { return [] }
        // Where the words start: the bubble hugs a short prompt, so its leading edge is its own
        // longest line back from the trailing one rather than the ceiling it may grow to.
        let head = measure - widest - ArgoFeedRow.bubbleInsetX
        // A folded prompt draws only its first few lines, and the reader decides which it is.
        // Reporting all of them drew a prompt of four lines where the feed showed two, which is the
        // complaint this whole pass answers — and capping an UNFOLDED one is the same mistake back.
        let shown = isFolded ? ArgoFeedRow.collapsedPromptLines : lay.widths.count
        return lay.widths.prefix(shown).enumerated().map { at, width in
            MinimapRowMark.line(at, width: width, in: .body, ink: .prompt)
                .indented(by: head)
                .lowered(by: ArgoFeedRow.bubbleInsetY)
        }
    }
}
