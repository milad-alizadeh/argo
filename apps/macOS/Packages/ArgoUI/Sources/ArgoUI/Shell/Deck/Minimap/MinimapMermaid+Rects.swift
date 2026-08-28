import Foundation

// A diagram in the lane: its own silhouette — a frame per node, a line per connector — rather than
// the featureless slab a fence draws as.
//
// Both the shapes and the height come from `ProseReading.plan`, which is the very layout
// `MermaidView` draws. Not an optimisation: it is what makes the two heights agree by construction
// instead of by two implementations happening to match.

extension MermaidDiagram {
    /// The diagram's figures as rectangles, and how tall the whole thing stands.
    @MainActor func mapped(across measure: CGFloat) -> (rects: [MinimapRowRect], height: CGFloat) {
        let plan = ProseReading.plan(of: self, across: measure)
        return (plan.figures.map(\.mapped), plan.size.height)
    }
}

extension MermaidFigure {
    /// One figure as the lane draws it. A connector is a hairline in both directions, so a straight
    /// line survives the reduction instead of collapsing to nothing.
    var mapped: MinimapRowRect {
        let bounds = form.bounds
        return MinimapRowRect(
            y: bounds.minY,
            height: max(bounds.height, MermaidMeasure.stroke),
            from: bounds.minX,
            to: max(bounds.maxX, bounds.minX + MermaidMeasure.stroke),
            ink: .diagram,
            shape: laneShape,
        )
    }

    /// A container is a frame; a connector is a bar, because a stroked hairline at the lane's scale
    /// is nothing at all.
    private var laneShape: FeedInk.Shape {
        switch role {
        case .node, .emphasis, .note: .frame
        case .edge: .bar
        }
    }
}
