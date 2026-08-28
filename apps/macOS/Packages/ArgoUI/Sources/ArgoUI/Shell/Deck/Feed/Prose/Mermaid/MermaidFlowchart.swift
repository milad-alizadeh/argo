import Foundation

/// A flowchart as its source wrote it: which way it runs, the nodes it named, the edges between
/// them and the `subgraph` blocks drawn around them.
///
/// Everything here is a fact the SOURCE stated. Nothing is placed, measured or defaulted to a
/// geometry — that is `laid`'s, and keeping the two apart is what lets one model be
/// laid out four ways for the four directions.
struct MermaidFlowchart: Equatable, Sendable {
    let direction: Direction
    /// Every node named, in the order the source first named one. That order IS the layout's
    /// tie-break, so a diagram read twice lays out twice the same.
    let nodes: [Node]
    let edges: [Edge]
    /// The `subgraph` blocks, in the order they were opened, each carrying the nodes it encloses.
    let groups: [Group]

    /// Which way the ranks grow. `TD` and `TB` are one direction under two spellings.
    enum Direction: Equatable, Sendable {
        case down, up, right, left
    }

    struct Node: Equatable, Sendable {
        let name: String
        /// What the box says. A bare node name IS its own label.
        var label: String
        var shape: Shape = .rect
    }

    /// The figures mermaid lets a node be drawn as, each its own outline — a reader tells a
    /// decision from a step by its shape before reading either.
    enum Shape: Equatable, Sendable, CaseIterable {
        case rect, rounded, stadium, subroutine, diamond, hexagon, circle, flag, cylinder
    }

    struct Edge: Equatable, Sendable {
        let from: String
        let to: String
        /// The word written on the connector, in either of mermaid's two spellings for it.
        var label: String?
        var stroke: Stroke = .solid
        /// `false` for an open link — `---` rather than `-->` — which is drawn without a head.
        var hasHead = true
    }

    enum Stroke: Equatable, Sendable {
        case solid, dotted, thick
    }

    /// A `subgraph` block: the title it was opened with and every node inside it, a nested block's
    /// members included so the outer enclosure really does contain the inner one.
    struct Group: Equatable, Sendable {
        let title: String
        let members: [String]
    }
}

extension MermaidFlowchart {
    /// One label per caption the plan places, in that order: every node, then every edge that
    /// carries a word, then every group's title.
    ///
    /// The view builds one `Text` from each of these before SwiftUI has told it a measure, so this
    /// order is a contract between the model and `laid` rather than an incidental.
    var labels: [MermaidLabel] {
        nodes.map { MermaidLabel(text: $0.label) }
            + edges.compactMap(\.label).map {
                MermaidLabel(text: $0, face: MermaidMeasure.edgeFace, role: .note)
            }
            + groups.map {
                MermaidLabel(text: $0.title, face: MermaidMeasure.groupFace, role: .note)
            }
    }

    var names: [String] {
        nodes.map(\.name)
    }

    /// What one node points at, in the order the source wrote the edges.
    func following(_ name: String) -> [String] {
        edges.filter { $0.from == name }.map(\.to)
    }
}
