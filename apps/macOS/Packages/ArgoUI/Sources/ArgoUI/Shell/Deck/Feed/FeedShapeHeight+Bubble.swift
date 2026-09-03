import ArgoDesign
import CoreGraphics
import ProseText

// A prompt's bubble, at the height `PromptBubbleLayout` gives it.
//
// The same three questions that layout answers, asked of the same measure: what the words wrap to
// inside the bubble's share of the column, what the pasted pictures took above them, and whether
// the prompt runs past the fold — which is the only thing that gives the control any room.

extension FeedShapeHeight {
    /// The bubble's own height, which is the row's: it is held against the trailing edge of a frame
    /// that adds nothing.
    func bubble(text: String, shots: [FeedShot]) -> CGFloat {
        let inside = ArgoFeedRow.bubbleInside(of: measure)
        guard inside > 0 else { return 0 }
        let parts = [words(text: text, shots: shots, inside: inside), control(text, inside: inside)]
            .compactMap(\.self)
        return Self.stacked(parts, step: ArgoSpacing.snug) + ArgoFeedRow.bubbleInsetY * 2
    }

    /// The words, and whatever was pasted in above them — the one subview `FeedPrompt` stacks.
    private func words(text: String, shots: [FeedShot], inside: CGFloat) -> CGFloat {
        let pictures = shots.isEmpty ? nil : Self.shots(shots, across: inside)
        let said = text.isEmpty ? nil : Self.folded(text, to: fold, across: inside)
        return Self.stacked([pictures, said].compactMap(\.self), step: ArgoSpacing.snug)
    }

    /// The control under them, or `nil` where the prompt stands whole — `PromptBubbleLayout` places
    /// it in a box of nothing there, which is what `FeedPrompt.disclosure` draws nothing in.
    private func control(_ text: String, inside: CGFloat) -> CGFloat? {
        let laid = ProseMetrics.lay(out: text, across: inside).lines
        guard laid > ArgoFeedRow.collapsedPromptLines else { return nil }
        return ceil(ProseFace(rung: ArgoTypography.caption.rung).lineBox)
    }

    /// How much of the prompt stands — all of it once the reader has let the fold out.
    private var fold: Int? {
        standing.isUnfolded ? nil : ArgoFeedRow.collapsedPromptLines
    }
}
