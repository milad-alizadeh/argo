import SwiftUI

/// A prompt's bubble, whole: its ceiling, its insets, and whether the words inside it are folded —
/// all decided from the proposal the bubble is actually given, in the pass that gives it.
///
/// A `Layout` for the reason `MarkdownTableLayout` is one. The feed measures a row with a single
/// `sizeThatFits` against a detached ruler. A bubble whose size came from a `@State` written by
/// `onGeometryChange` answered that one pass with a ceiling it had not learned and a fold it had
/// not decided — measured at the FULL column, with no control under it. The table cached that
/// height and the cell then drew the real thing, and the difference between them is #946: the
/// squashed bubble, and the **Show less** the code does draw clipped out of the row.
///
/// Subviews, in order: the words — a gallery above them where the prompt came with pictures — and
/// the control that folds them. The control is placed only where there is something folded away;
/// where there is not, it is given no room at all, which is what `FeedPrompt.disclosure` draws
/// nothing on.
struct PromptBubbleLayout: Layout {
    /// The prompt's own words. Whether they are long is asked of `ProseMetrics` rather than of the
    /// subviews: it is a question about the measure they landed in, and the overview lane answers
    /// it from the same place — a bubble and its miniature working it out apart is how they drift.
    let text: String

    /// Between the words and the control under them.
    private var step: CGFloat {
        ArgoSpacing.snug
    }

    func sizeThatFits(
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache _: inout (),
    )
        -> CGSize {
        let inside = inside(of: proposal)
        let parts = parts(of: subviews, across: inside)
        return CGSize(
            width: parts.map(\.width).max().map { $0 + ArgoFeedRow.bubbleInsetX * 2 } ?? 0,
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
        // Nothing folded away: the control is given a box of nothing, which is what it draws in.
        guard parts.count < subviews.count else { return }
        subviews[subviews.count - 1].place(at: bounds.origin, anchor: .topLeading, proposal: .zero)
    }

    /// The measure the words are laid out across: the bubble's share of the column, less its own
    /// insets. `nil` where the proposal states no width, which is a question about the bubble's
    /// ideal size rather than about a column it landed in.
    private func inside(of proposal: ProposedViewSize) -> CGFloat? {
        guard let width = proposal.width, width.isFinite else { return nil }
        return max(0, width * ArgoFeedRow.bubbleShare - ArgoFeedRow.bubbleInsetX * 2)
    }

    /// What is actually drawn, at the sizes it takes: the words, and the control under them where
    /// the words do not all stand.
    private func parts(of subviews: Subviews, across inside: CGFloat?) -> [CGSize] {
        guard let first = subviews.first else { return [] }
        let room = ProposedViewSize(width: inside, height: nil)
        let words = first.sizeThatFits(room)
        guard subviews.count > 1, isFolded(across: inside) else { return [words] }
        return [words, subviews[1].sizeThatFits(room)]
    }

    /// Whether anything is hidden at this measure. A control offering to unfold a prompt that is
    /// already whole is a claim there is more to read.
    private func isFolded(across inside: CGFloat?) -> Bool {
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
