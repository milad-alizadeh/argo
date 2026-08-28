import Foundation

/// What the layered pass lays out: named boxes of a known size, the edges between them, and the
/// enclosures drawn round them.
///
/// The pass's own vocabulary rather than any one reader's. A flowchart states it and so does a
/// state machine, and neither can see the other's shapes, strokes or keywords from in here — which
/// is what lets ONE ranking, ordering, placement and routing serve both (#861, #863).
///
/// A node arrives already MEASURED. What a figure has to be to hold its words is the reader's own
/// answer — a diamond is wider than its label, a start dot has none at all — and a pass that asked
/// would have to know every shape every reader will ever draw.
struct MermaidGraph: Equatable, Sendable {
    let direction: MermaidDirection
    /// Every node, in the order the source first named one. That order IS the layout's tie-break,
    /// so a diagram read twice lays out twice the same.
    let nodes: [Node]
    let edges: [Edge]
    /// The enclosures, in the order they were opened, each carrying the names it holds — a nested
    /// block's members included, so the outer frame really does contain the inner one.
    let groups: [[String]]

    struct Node: Equatable, Sendable {
        let name: String
        let size: CGSize
    }

    /// One connector. How it is stroked and whether it ends in a head, because the pass draws it —
    /// but never what it SAYS, because a word is a caption and captions are the reader's.
    struct Edge: Equatable, Sendable {
        let from: String
        let to: String
        var line: MermaidFigure.Line = .solid
        var hasHead = true
    }

    var names: [String] {
        nodes.map(\.name)
    }
}
