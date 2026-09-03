import Foundation

// A flowchart stated as a graph the layered pass can lay out: the boxes its shapes need, the
// strokes its links draw, and the enclosures its `subgraph` blocks ask for.
//
// The one place the flowchart's own vocabulary meets the pass's. Everything below here speaks in
// `MermaidGraph`, which is why a state machine lays out through the very same four passes (#863).

extension MermaidFlowchart {
    var graph: MermaidGraph {
        MermaidGraph(
            direction: direction,
            nodes: nodes.map {
                MermaidGraph.Node(
                    name: $0.name, size: Self.box(of: $0), fillsBox: Self.fills($0.shape),
                )
            },
            edges: edges.map {
                MermaidGraph.Edge(
                    from: $0.from, to: $0.to,
                    line: MermaidFigure.Line($0.stroke), head: $0.hasHead ? .arrow : .none,
                )
            },
            groups: groups.map(\.members),
        )
    }

    /// One node's box: the room its words need, grown to what the FIGURE around them adds. Every
    /// one of those growths is `MermaidWords`', so a flowchart and a mindmap widen a hexagon by
    /// the same point.
    private static func box(of node: Node) -> CGSize {
        let words = MermaidWords.box(of: node.label)
        switch node.shape {
        case .circle: return MermaidWords.squared(words)
        case .diamond: return MermaidWords.inscribed(words)
        case .hexagon, .flag: return MermaidWords.pointed(words)
        case .rect, .rounded, .stadium, .subroutine, .cylinder: return words
        }
    }

    /// Which shapes really reach the whole of the box they are drawn in — the ones a fanned end
    /// may stand anywhere along. Every other shape here touches its box at the middle of a face
    /// and falls away from it, so an end moved along that face would hang off nothing (#920).
    private static func fills(_ shape: Shape) -> Bool {
        switch shape {
        case .rect, .rounded, .subroutine: true
        case .circle, .diamond, .stadium, .hexagon, .flag, .cylinder: false
        }
    }
}

extension MermaidFigure.Line {
    /// How a link is drawn, from what it was written as.
    init(_ stroke: MermaidFlowchart.Stroke) {
        switch stroke {
        case .solid: self = .solid
        case .dotted: self = .dotted
        case .thick: self = .thick
        }
    }
}
