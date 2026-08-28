import SwiftUI

/// A diagram's own layout: the plan is laid out across the PROPOSAL the block is actually given,
/// the block takes the plan's size, and every caption is placed on the rect it was measured into.
///
/// A `Layout` for `MarkdownTableLayout`'s reason: the geometry is a function of the proposal, and a
/// width learned through `@State` would arrive one frame after the feed had measured the row and
/// cached its height — so the row would keep the height of a layout nobody ever saw.
///
/// Subviews arrive one per `MermaidDiagram.labels`, in that order, which is the order the plan
/// captions them.
struct MermaidLayout: Layout {
    let diagram: MermaidDiagram

    func sizeThatFits(
        proposal: ProposedViewSize,
        subviews _: Subviews,
        cache _: inout (),
    )
        -> CGSize {
        plan(across: proposal.width).size
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache _: inout (),
    ) {
        for (caption, subview) in zip(plan(across: proposal.width).captions, subviews) {
            place(caption, subview: subview, in: bounds)
        }
    }

    /// One caption, on the rect the plan measured it into — held at the rect's own width so a label
    /// that outgrew its box wraps inside the diagram rather than over the figure beside it.
    private func place(_ caption: MermaidCaption, subview: Subviews.Element, in bounds: CGRect) {
        let rect = caption.rect.offsetBy(dx: bounds.minX, dy: bounds.minY)
        subview.place(
            at: CGPoint(x: caption.alignment.x(in: rect), y: rect.midY),
            anchor: caption.alignment.anchor,
            proposal: ProposedViewSize(rect.size),
        )
    }

    /// The one cached layout, from the one place this type reaches for it. An unspecified proposal
    /// is answered at nothing, which is the plan at its own natural width — SwiftUI probes with one
    /// before it has a column to offer.
    ///
    /// SwiftUI runs layout on the main actor, but `Layout` itself makes no such claim — and the
    /// plan behind it is the main actor's cache. Asserting it here is what lets ONE layout serve
    /// the drawn diagram and the lane that maps it.
    private func plan(across measure: CGFloat?) -> MermaidPlan {
        MainActor.assumeIsolated { ProseReading.plan(of: diagram, across: measure ?? 0) }
    }
}

private extension MermaidCaption.Alignment {
    func x(in rect: CGRect) -> CGFloat {
        switch self {
        case .leading: rect.minX
        case .middle: rect.midX
        case .trailing: rect.maxX
        }
    }

    var anchor: UnitPoint {
        switch self {
        case .leading: .leading
        case .middle: .center
        case .trailing: .trailing
        }
    }
}
