import Foundation
import MermaidLayout

// A diagram in the lane: its own silhouette — a frame per node, a line per connector — rather than
// the featureless slab a fence draws as.
//
// Both the shapes and the height come from `MermaidDiagram.plan`, which is the very layout
// `MermaidView` draws. Not an optimisation: it is what makes the two heights agree by construction
// instead of by two implementations happening to match.

extension MermaidDiagram {
    /// The diagram's figures as rectangles, and how tall the whole thing stands.
    ///
    /// The measure CLIPS rather than lays out. A diagram is laid out at its own width and scrolls
    /// where the column cannot hold it, so what the lane draws is what a reader who has not
    /// scrolled can see — a mark past the column's edge is one that is not on screen.
    func mapped(across measure: CGFloat) -> (rects: [MinimapRowRect], height: CGFloat) {
        let plan = ProseReading.plan(of: self)
        return (plan.figures.compactMap { $0.mapped(within: measure) }, plan.size.height)
    }
}

extension MermaidFigure {
    /// One figure as the lane draws it, or nothing where it stands entirely past the column's edge.
    /// A connector is a hairline in both directions, so a straight line survives the reduction
    /// instead of collapsing to nothing.
    func mapped(within measure: CGFloat) -> MinimapRowRect? {
        let box = bounds
        guard box.minX < measure else { return nil }
        return MinimapRowRect(
            y: box.minY,
            height: max(box.height, MermaidMeasure.stroke),
            from: box.minX,
            to: min(measure, max(box.maxX, box.minX + MermaidMeasure.stroke)),
            ink: .diagram,
            shape: laneShape,
        )
    }

    /// A container is a frame; a connector is a bar, because a stroked hairline at the lane's scale
    /// is nothing at all.
    private var laneShape: FeedInk.Shape {
        isConnector ? .bar : .frame
    }
}
