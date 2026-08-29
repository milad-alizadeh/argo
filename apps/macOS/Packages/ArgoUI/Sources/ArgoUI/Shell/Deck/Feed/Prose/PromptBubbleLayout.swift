import SwiftUI

/// A prompt's bubble, whole: its ceiling, its insets, and whether there is more of the prompt than
/// the fold shows — all decided from the proposal the bubble is given, in the pass that gives it.
/// WHICH of the two the reader is looking at is not decided here: that is `FeedPrompt.isExpanded`,
/// the reader's own, and it reaches the words as a line limit.
///
/// A `Layout` for the reason `MarkdownTableLayout` is one. The feed measures a row with a single
/// `sizeThatFits` against a detached ruler. A bubble whose size came from a `@State` written by
/// `onGeometryChange` answered that one pass with a ceiling it had not learned and a fold it had
/// not decided — measured at the FULL column, with no control under it. The table cached that
/// height and the cell then drew the real thing, and the difference between them is #946: the
/// squashed bubble, and the **Show less** the code does draw clipped out of the row.
///
/// Subviews, in order: the words — a gallery above them where the prompt came with pictures — and
/// the control that folds them. Every subview is placed, always. The control is given ROOM only
/// where the prompt runs past the fold; where it does not, it is placed in a box of nothing, which
/// is what `FeedPrompt.disclosure` draws nothing in.
struct PromptBubbleLayout: Layout {
    /// The prompt's own words. Whether they are long is asked of `ProseMetrics` rather than of the
    /// subviews: it is a question about the measure they landed in, and the overview lane answers
    /// it from the same place — a bubble and its miniature working it out apart is how they drift.
    let text: String

    /// Between the words and the control under them.
    private let step = ArgoSpacing.snug

    func sizeThatFits(
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache _: inout (),
    )
        -> CGSize {
        let parts = parts(of: subviews, across: inside(of: proposal))
        guard let widest = parts.map(\.width).max() else { return .zero }
        return CGSize(
            width: widest + ArgoFeedRow.bubbleInsetX * 2,
            height: stacked(parts) + ArgoFeedRow.bubbleInsetY * 2,
        )
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache _: inout (),
    ) {
        let inside = inside(of: proposal)
        let parts = parts(of: subviews, across: inside)
        var y = bounds.minY + ArgoFeedRow.bubbleInsetY
        for (at, part) in parts.enumerated() {
            subviews[at].place(
                at: CGPoint(x: bounds.maxX - ArgoFeedRow.bubbleInsetX, y: y),
                anchor: .topTrailing,
                proposal: ProposedViewSize(part),
            )
            y += part.height + step
        }
        // Whatever was not given room — the control, where the prompt stands inside the fold — is
        // placed in a box of nothing rather than left unplaced, which draws it at full size.
        for at in parts.count ..< subviews.count {
            subviews[at].place(at: bounds.origin, anchor: .topLeading, proposal: .zero)
        }
    }

    /// The measure the words are laid out across: the bubble's share of the column, less its own
    /// insets. `nil` where the proposal states no width, which is a question about the bubble's
    /// ideal size rather than about a column it landed in.
    private func inside(of proposal: ProposedViewSize) -> CGFloat? {
        guard let width = proposal.width, width.isFinite else { return nil }
        return ArgoFeedRow.bubbleInside(of: width)
    }

    /// What is given room, at the size it takes: the words, and the control under them where the
    /// prompt runs past the fold.
    ///
    /// The control never widens the bubble: it is asked at its own width and then held to the
    /// words'. Asked across `inside` it answers with the whole ceiling, and allowed its own it can
    /// outrun a prompt that ran past the fold on line breaks rather than on wrapping — either way
    /// the bubble would end somewhere the overview lane's miniature does not, since that hugs the
    /// widest LINE (`MinimapRowShape.bubble`). That drift is what this type exists to stop.
    private func parts(of subviews: Subviews, across inside: CGFloat?) -> [CGSize] {
        guard let first = subviews.first else { return [] }
        let words = first.sizeThatFits(ProposedViewSize(width: inside, height: nil))
        guard subviews.count > 1, runsPastTheFold(across: inside) else { return [words] }
        let control = subviews[1].sizeThatFits(.unspecified)
        return [words, CGSize(width: min(control.width, words.width), height: control.height)]
    }

    /// Whether the prompt is longer than the fold shows — the question the CONTROL is offered on,
    /// and not a question about which state the reader has it in. A **Show less** has to stand
    /// while the prompt is unfolded, so this must answer the same either way.
    ///
    /// Deliberately not called `isFolded`: that word means "the reader has not unfolded it" in
    /// `MinimapRowShape.bubble` and in the lane that calls it.
    private func runsPastTheFold(across inside: CGFloat?) -> Bool {
        guard let inside else { return false }
        // SwiftUI runs layout on the main actor, but `Layout` itself makes no such claim — and the
        // wrap below is the main actor's cache.
        return MainActor.assumeIsolated {
            ProseMetrics.lay(out: text, across: inside).lines > ArgoFeedRow.collapsedPromptLines
        }
    }

    private func stacked(_ parts: [CGSize]) -> CGFloat {
        guard !parts.isEmpty else { return 0 }
        return parts.map(\.height).reduce(0, +) + CGFloat(parts.count - 1) * step
    }
}
