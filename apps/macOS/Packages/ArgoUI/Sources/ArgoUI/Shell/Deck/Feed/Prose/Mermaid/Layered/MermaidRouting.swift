import Foundation

/// One edge, drawn: the connector between two boxes, its head, and where its word sits.
///
/// Orthogonal between rank boundaries — out of the box's own face, across the gap, into the next
/// one's. Routing that also avoids passing through an UNRELATED box is deliberately not here: it is
/// a change behind this same seam, and a diagram that reads badly for it reads badly rather than
/// wrongly (#861).
struct MermaidRouting {
    let placement: MermaidPlacement
    /// Where every edge meets the boxes at its two ends — the middle of a face it has to itself,
    /// and its own place along one it shares (#920).
    private let exits: MermaidExits

    init(graph: MermaidGraph, placement: MermaidPlacement, reversed: Set<Int>) {
        self.placement = placement
        self.exits = MermaidExits.of(graph, placement: placement, reversed: reversed)
    }
}

extension MermaidRouting {
    /// The figures one edge draws, and the point its word is written at. Nothing at all for an edge
    /// naming a node that was never placed, which is a state the reader does not produce.
    func drawn(_ edge: MermaidGraph.Edge, at index: Int) -> MermaidRoute? {
        guard let attach = exits.ends[index] else { return nil }
        let points = exits.around.contains(index)
            ? around(attach, lane: lane(of: index))
            : between(attach)
        guard let ends = MermaidEnds.of(points, edge: edge) else { return nil }
        let middle = Self.mid(of: points)
        return MermaidRoute(
            figures: Self.marks(of: ends, on: edge), mid: middle.at, run: middle.run,
            tail: ends.tail, head: ends.head,
        )
    }

    /// A forward edge: out of the leaving box's own face, across the gap in the middle, and into
    /// the entering box's. Three segments where the two boxes are not in line and one where they
    /// are, which is what makes a straight chain read as a straight line.
    private func between(_ ends: MermaidExits.Pair) -> [CGPoint] {
        let grain = placement.grain
        let (start, end) = (ends.tail, ends.head)
        guard grain.across(of: start) != grain.across(of: end) else { return [start, end] }
        let turn = (grain.along(of: start) + grain.along(of: end)) / 2
        return [
            start,
            grain.point(along: turn, across: grain.across(of: start)),
            grain.point(along: turn, across: grain.across(of: end)),
            end,
        ]
    }

    /// An edge that runs BACK against the ranks — a cycle's own closing edge, or a self-loop. It
    /// leaves and re-enters by the flank and runs its length in a lane outside the diagram, so it
    /// never shares a line with the forward edges it is answering.
    private func around(_ ends: MermaidExits.Pair, lane: CGFloat) -> [CGPoint] {
        let grain = placement.grain
        let (start, end) = (ends.tail, ends.head)
        return [
            start,
            grain.point(along: grain.along(of: start), across: lane),
            grain.point(along: grain.along(of: end), across: lane),
            end,
        ]
    }

    /// The lane one back edge runs in: one step further out than the back edge before it, counted
    /// off the leading edge of the whole diagram rather than off either box.
    ///
    /// A lane per edge and not one for all of them. Two edges closing the same loop share a lane
    /// otherwise, and two lines drawn on top of each other read as one edge that is not there.
    private func lane(of index: Int) -> CGFloat {
        let ordinal = exits.around.count { $0 < index } + 1
        return -MermaidMeasure.backLane * CGFloat(ordinal)
    }

    /// The connector, already stopped short of whatever finishes it, and the pass's own head at
    /// each end that asked for one. A cap asking only for ROOM draws nothing here — the mark that
    /// stands in it is the reader's (#865).
    private static func marks(of ends: MermaidEnds, on edge: MermaidGraph.Edge) -> [MermaidFigure] {
        [MermaidFigure(form: .path(ends.stroke), role: .edge, line: edge.line)]
            + head(ends, of: edge)
    }

    private static func head(_ ends: MermaidEnds, of edge: MermaidGraph.Edge) -> [MermaidFigure] {
        guard edge.head == .arrow, let stem = ends.stroke.last else { return [] }
        return [MermaidFigure(
            form: .arrowhead(tip: ends.head.at, from: stem), role: .edge, line: edge.line,
        )]
    }

    /// The middle of a route, measured ALONG it rather than between its ends, and the way the line
    /// runs there — so a word written on it sits on the line it belongs to whatever turns that line
    /// took, and knows which side of it is clear.
    private static func mid(of points: [CGPoint]) -> (at: CGPoint, run: CGPoint) {
        guard let first = points.first else { return (.zero, CGPoint(x: 0, y: 1)) }
        let lengths = zip(points, points.dropFirst()).map { hypot($1.x - $0.x, $1.y - $0.y) }
        var left = lengths.reduce(0, +) / 2
        for (at, length) in lengths.enumerated() {
            guard left > length else {
                let span = CGPoint(
                    x: points[at + 1].x - points[at].x, y: points[at + 1].y - points[at].y,
                )
                let step = length == 0 ? 0 : left / length
                return (
                    CGPoint(x: points[at].x + span.x * step, y: points[at].y + span.y * step),
                    length == 0
                        ? CGPoint(x: 0, y: 1)
                        : CGPoint(x: span.x / length, y: span.y / length),
                )
            }
            left -= length
        }
        return (first, CGPoint(x: 0, y: 1))
    }
}
