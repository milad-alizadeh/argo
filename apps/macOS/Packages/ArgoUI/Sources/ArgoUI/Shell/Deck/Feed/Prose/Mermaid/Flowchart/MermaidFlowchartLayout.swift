import Foundation

// A flowchart placed, in the four passes a layered layout has: rank the nodes, order each rank to
// cross as few edges as possible, put the boxes down, then route the edges between the rank
// boundaries. The direction changes the AXIS those ranks grow along, never the passes.
//
// The plan is INDEPENDENT of the measure it is asked for. A flowchart is as wide as its widest rank
// and no column can change that, so a diagram too wide for the prose it sits in is scrolled rather
// than reflowed — which also means the renderer and the lane read one geometry whatever width
// either of them happens to ask at.

@MainActor
extension MermaidFlowchart {
    var laid: MermaidPlan {
        let ranked = ranking()
        let rows = MermaidOrdering.rows(of: self, ranked: ranked)
        let placement = MermaidPlacement.of(self, rows: rows)
        let routing = MermaidRouting(placement: placement, reversed: ranked.reversed)
        // One entry per edge and one per group, `nil` included. Compacting these BEFORE the
        // captions are built is what would slide every later caption one place along `labels`, and
        // `MermaidLayout` places its subviews by that position alone.
        let routes = edges.enumerated().map { routing.drawn($1, at: $0) }
        let enclosures = groups.map { MermaidEnclosure.drawn($0, in: placement.boxes) }
        return Self.normalised(MermaidPlan(
            // Enclosures first, so a frame sits UNDER the boxes it is drawn around.
            figures: enclosures.compactMap { $0?.figure }
                + nodes.compactMap { node in
                    placement.boxes[node.name].map { figure(of: node, in: $0) }
                }
                + routes.compactMap(\.self).flatMap(\.figures),
            captions: captions(in: placement.boxes) + wordsOn(routes) + titles(on: enclosures),
            size: placement.size,
        ))
    }

    /// One node's own figure, in the box it was measured into.
    private func figure(of node: Node, in box: CGRect) -> MermaidFigure {
        MermaidFigure(form: .shape(node.shape.outline, box))
    }

    /// One caption per node, in the order the source named them — which is the order `labels`
    /// lists them, and the pairing the view rests on. A node with no box gets a caption with no
    /// room rather than no caption: dropping one would shift every label after it.
    private func captions(in boxes: [String: CGRect]) -> [MermaidCaption] {
        zip(nodes, labels).map { node, label in
            MermaidCaption(label: label, rect: boxes[node.name] ?? .zero)
        }
    }

    /// Each group's title, in the band along the top of its own frame.
    private func titles(on enclosures: [(figure: MermaidFigure, title: CGRect)?])
        -> [MermaidCaption] {
        zip(groups, enclosures).map { group, enclosure in
            MermaidCaption(
                label: MermaidLabel(
                    text: group.title, face: MermaidMeasure.groupFace, role: .note,
                ),
                rect: enclosure?.title ?? .zero,
                alignment: .leading,
            )
        }
    }

    /// An edge's own word, beside the middle of the line it belongs to rather than on top of it —
    /// the connector runs under a caption otherwise. One per edge that HAS a word, which is what
    /// `labels` lists; an unrouted edge keeps its caption and loses only its place.
    private func wordsOn(_ routes: [MermaidRoute?]) -> [MermaidCaption] {
        zip(edges, routes).compactMap { edge, route in
            guard let text = edge.label else { return nil }
            let face = MermaidMeasure.edgeFace
            let size = CGSize(
                width: ceil(ProseMetrics.width(of: text, in: face)),
                height: ceil(face.lineBox),
            )
            return MermaidCaption(
                label: MermaidLabel(text: text, face: face, role: .note),
                rect: route
                    .map { CGRect(origin: Self.beside($0, size: size), size: size) } ?? .zero,
            )
        }
    }

    /// Where a word of that size stands beside a route: square out from the line at its middle, far
    /// enough that the box clears the stroke whichever way the line was running.
    private static func beside(_ route: MermaidRoute, size: CGSize) -> CGPoint {
        let aside = CGPoint(x: -route.run.y, y: route.run.x)
        let clear = abs(aside.x) * size.width / 2 + abs(aside.y) * size.height / 2
            + MermaidMeasure.wordGap
        return CGPoint(
            x: route.mid.x + aside.x * clear - size.width / 2,
            y: route.mid.y + aside.y * clear - size.height / 2,
        )
    }

    /// The same plan slid into positive coordinates, at the size it really stands. A back edge's
    /// lane and an enclosure's frame both reach outside the boxes, and a plan whose marks start at
    /// a negative is a plan whose left-hand edge is drawn off the block.
    private static func normalised(_ plan: MermaidPlan) -> MermaidPlan {
        let marks = plan.figures.map(\.form.bounds) + plan.captions.map(\.rect)
        guard let first = marks.first else { return plan }
        let bounds = marks.dropFirst().reduce(first) { $0.union($1) }
        let offset = CGPoint(x: -bounds.minX, y: -bounds.minY)
        return MermaidPlan(
            figures: plan.figures.map {
                MermaidFigure(form: $0.form.moved(by: offset), role: $0.role, line: $0.line)
            },
            captions: plan.captions.map {
                MermaidCaption(
                    label: $0.label,
                    rect: $0.rect.offsetBy(dx: offset.x, dy: offset.y),
                    alignment: $0.alignment,
                )
            },
            size: CGSize(width: ceil(bounds.width), height: ceil(bounds.height)),
        )
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
