import Foundation

// A flowchart placed. The four passes of the layered layout are `MermaidLayered`'s and are not
// spelled here — this states the graph, names the figures its shapes draw, and hands the pass's own
// placements back as one plan.

extension MermaidFlowchart {
    var laid: MermaidPlan {
        let laid = MermaidLayered.of(graph)
        let words = captions
        return MermaidPlan(
            // Enclosures first, so a frame sits UNDER the boxes it is drawn around.
            figures: laid.frames
                + nodes.compactMap { node in
                    laid.boxes[node.name].map {
                        MermaidFigure(form: .shape(node.shape.outline, $0))
                    }
                }
                + laid.connectors,
            captions: laid.captions(words.nodes, on: names)
                + laid.words(edges.map(\.label))
                + laid.titles(words.groups),
            size: laid.size,
        ).normalised
    }
}

extension MermaidFlowchart.Shape {
    /// The outline mermaid draws this shape as.
    var outline: MermaidOutline {
        switch self {
        case .rect: .rect
        case .rounded: .rounded
        case .stadium: .capsule
        case .subroutine: .subroutine
        case .diamond: .diamond
        case .hexagon: .hexagon
        case .circle: .ellipse
        case .flag: .flag
        case .cylinder: .cylinder
        }
    }
}
