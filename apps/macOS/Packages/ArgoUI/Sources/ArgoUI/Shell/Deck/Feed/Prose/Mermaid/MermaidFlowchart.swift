import Foundation

/// The simplest flowchart there is: a `graph`/`flowchart` header and arrows between bare node
/// names.
///
/// Everything else a flowchart can say — node shapes, labelled edges, subgraphs, a direction other
/// than top-down — is #861's. Until then it is not read at all, and a fence Argo cannot read is the
/// fence it is today.
struct MermaidFlowchart: Equatable, Sendable {
    /// Every node named, in the order the source first named one. That order IS the layout's
    /// tie-break, so a diagram read twice lays out twice the same.
    let nodes: [String]
    let edges: [Edge]

    struct Edge: Equatable, Sendable {
        let from: String
        let to: String
    }

    /// One label per node, in the order its plan captions them. A bare node name IS its label,
    /// which is the only labelling this reader understands.
    var labels: [MermaidLabel] {
        nodes.map { MermaidLabel(text: $0) }
    }
}

extension MermaidFlowchart {
    /// The flowchart this source draws, or `nil` for anything this reader cannot. Nothing is
    /// guessed and nothing is skipped: a source read half-way would draw a diagram the author did
    /// not write.
    static func read(_ source: String) -> MermaidFlowchart? {
        var lines = source
            .components(separatedBy: "\n")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        guard !lines.isEmpty, isHeader(lines.removeFirst()) else { return nil }
        var nodes: [String] = []
        var edges: [Edge] = []
        for line in lines {
            guard let edge = Edge.read(line) else { return nil }
            for name in [edge.from, edge.to] where !nodes.contains(name) {
                nodes.append(name)
            }
            edges.append(edge)
        }
        // A header on its own is a diagram with nothing in it, which is nothing to draw.
        guard !edges.isEmpty else { return nil }
        return MermaidFlowchart(nodes: nodes, edges: edges)
    }

    /// `graph TD` and `flowchart TB`, and no other direction yet: a direction read and then drawn
    /// top-down anyway would be a diagram nobody wrote.
    private static func isHeader(_ line: String) -> Bool {
        let words = line.split(separator: " ", omittingEmptySubsequences: true).map(String.init)
        guard words.count == 2, ["graph", "flowchart"].contains(words[0].lowercased()) else {
            return false
        }
        return ["TD", "TB"].contains(words[1].uppercased())
    }
}

extension MermaidFlowchart.Edge {
    /// `A --> B`, and nothing else on the line.
    static func read(_ line: String) -> Self? {
        let sides = line
            .components(separatedBy: "-->")
            .map { $0.trimmingCharacters(in: .whitespaces) }
        guard sides.count == 2, sides.allSatisfy(isName) else { return nil }
        return MermaidFlowchart.Edge(from: sides[0], to: sides[1])
    }

    /// A bare node name — letters, digits and underscores. `A[Start]` is a node SHAPE and
    /// `A -->|yes| B` a labelled edge; both are #861's, and a fence until then.
    private static func isName(_ text: String) -> Bool {
        !text.isEmpty && text.allSatisfy { $0.isLetter || $0.isNumber || $0 == "_" }
    }
}
