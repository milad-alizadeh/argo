import MermaidLayout
import SwiftUI

/// A diagram's own layout: the block takes the plan's size, and every caption is placed on the rect
/// it was measured into.
///
/// A `Layout` for `MarkdownTableLayout`'s reason: the captions are real `Text` views and only the
/// layout system can put a view on a rect a value decided. It answers the same size at every
/// proposal, because the plan behind it is the same plan at every width — see
/// `MermaidDiagram.laid`.
///
/// Subviews arrive one per `MermaidDiagram.labels`, in that order, which is the order the plan
/// captions them.
struct MermaidCaptionLayout: Layout {
    let diagram: MermaidDiagram

    func sizeThatFits(
        proposal _: ProposedViewSize,
        subviews _: Subviews,
        cache _: inout (),
    )
        -> CGSize {
        plan.size
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal _: ProposedViewSize,
        subviews: Subviews,
        cache _: inout (),
    ) {
        for (caption, subview) in zip(plan.captions, subviews) {
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

    /// The one cached layout, from the one place this type reaches for it.
    ///
    /// SwiftUI runs layout on the main actor, but `Layout` itself makes no such claim — and the
    /// plan behind it is the main actor's cache. Asserting it here is what lets ONE layout serve
    /// the drawn diagram and the lane that maps it.
    private var plan: MermaidPlan {
        MainActor.assumeIsolated { MermaidPlans.of(diagram) }
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
