import Foundation

// A flowchart placed: ranks stacked top-down, each rank's nodes centred across the measure, and
// every edge a line from the box it leaves to the box it enters with a head on its end.
//
// The nodes are measured with the same prose metrics the paragraphs around the diagram are measured
// with, so a diagram sets at the feed's rhythm rather than floating at a scale of its own.

@MainActor
extension MermaidFlowchart {
    func laid(across measure: CGFloat) -> MermaidPlan {
        let boxes = boxes(across: measure)
        return MermaidPlan(
            figures: nodes.compactMap { boxes[$0] }.map { MermaidFigure(form: .roundedRect($0)) }
                + edges.flatMap { drawn($0, in: boxes) },
            captions: zip(nodes, labels).compactMap { name, label in
                boxes[name].map { MermaidCaption(label: label, rect: $0) }
            },
            size: CGSize(
                width: max(measure, boxes.values.map(\.maxX).max() ?? 0),
                height: boxes.values.map(\.maxY).max() ?? 0,
            ),
        )
    }

    /// Every node's box. A rank is a row: its nodes keep the order the source named them, and the
    /// row is centred on whichever is wider, the measure or the row itself — a flowchart too wide
    /// for the column reports the width it really stands at rather than pretending to fit.
    private func boxes(across measure: CGFloat) -> [String: CGRect] {
        let sizes = nodes.reduce(into: [String: CGSize]()) { $0[$1] = Self.size(of: $1) }
        let rows = ranked()
        let width = max(measure, rows.map { Self.width(of: $0, in: sizes) }.max() ?? 0)
        var boxes: [String: CGRect] = [:]
        var y: CGFloat = 0
        for row in rows {
            var x = (width - Self.width(of: row, in: sizes)) / 2
            for name in row {
                let size = sizes[name] ?? .zero
                boxes[name] = CGRect(origin: CGPoint(x: x, y: y), size: size)
                x += size.width + MermaidMeasure.nodeGap
            }
            y += (row.compactMap { sizes[$0]?.height }.max() ?? 0) + MermaidMeasure.rankGap
        }
        return boxes
    }

    /// The nodes of each rank, deepest last. A node the source named and no edge reached still has
    /// a rank of zero, so nothing read is left unplaced.
    private func ranked() -> [[String]] {
        let ranks = ranks()
        return (0 ... (ranks.values.max() ?? 0)).map { rank in
            nodes.filter { ranks[$0] == rank }
        }
    }

    /// Each node's depth: one more than the deepest node with an edge into it. Relaxed rather than
    /// walked, and only as many passes as there are nodes, so a cycle settles instead of looping
    /// for ever.
    private func ranks() -> [String: Int] {
        var ranks = nodes.reduce(into: [String: Int]()) { $0[$1] = 0 }
        for _ in nodes.indices {
            var moved = false
            for edge in edges where ranks[edge.to, default: 0] <= ranks[edge.from, default: 0] {
                ranks[edge.to] = ranks[edge.from, default: 0] + 1
                moved = true
            }
            guard moved else { break }
        }
        return ranks
    }

    /// One edge: a line from the face of the box it leaves to the face of the box it enters,
    /// stopped short of its own head so the head reads as a point rather than a blot.
    private func drawn(_ edge: Edge, in boxes: [String: CGRect]) -> [MermaidFigure] {
        guard let from = boxes[edge.from], let to = boxes[edge.to] else { return [] }
        let isDownward = from.midY <= to.midY
        let start = CGPoint(x: from.midX, y: isDownward ? from.maxY : from.minY)
        let tip = CGPoint(x: to.midX, y: isDownward ? to.minY : to.maxY)
        let stem = CGPoint(
            x: tip.x,
            y: isDownward ? tip.y - MermaidMeasure.arrowLength : tip.y + MermaidMeasure.arrowLength,
        )
        return [
            MermaidFigure(form: .path([start, stem]), role: .edge),
            MermaidFigure(form: .arrowhead(tip: tip, from: stem), role: .edge),
        ]
    }

    /// How wide a rank stands: its boxes and the gaps between them.
    private static func width(of row: [String], in sizes: [String: CGSize]) -> CGFloat {
        row.compactMap { sizes[$0]?.width }.reduce(0, +)
            + MermaidMeasure.nodeGap * CGFloat(max(0, row.count - 1))
    }

    /// One node's box: its label at the feed's own prose metrics, plus the room around it. Whole
    /// points, so the height the lane reports is the height SwiftUI draws rather than a fraction
    /// either of them might round differently.
    private static func size(of label: String) -> CGSize {
        CGSize(
            width: max(
                MermaidMeasure.nodeMinWidth,
                ceil(ProseMetrics.width(of: label)) + MermaidMeasure.nodeInsetX * 2,
            ),
            height: ceil(ProseFace.body.lineBox) + MermaidMeasure.nodeInsetY * 2,
        )
    }
}
