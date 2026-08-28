import Foundation

/// One edge, drawn: the connector between two boxes, its head, and where its word sits.
///
/// Orthogonal between rank boundaries — out of the box's own face, across the gap, into the next
/// one's. Routing that also avoids passing through an UNRELATED box is deliberately not here: it is
/// a change behind this same seam, and a diagram that reads badly for it reads badly rather than
/// wrongly (#861).
struct MermaidRouting {
    let placement: MermaidPlacement
    /// The edges the ranking had to turn around, which run back against the ranks and so cannot be
    /// drawn down the same lane as the rest.
    let reversed: Set<Int>
}

extension MermaidRouting {
    /// The figures one edge draws, and the point its word is written at. Nothing at all for an edge
    /// naming a node that was never placed, which is a state the reader does not produce.
    func drawn(_ edge: MermaidGraph.Edge, at index: Int) -> MermaidRoute? {
        guard let from = placement.boxes[edge.from], let to = placement.boxes[edge.to] else {
            return nil
        }
        let points = reversed.contains(index) || from == to
            ? around(from, to: to, lane: lane(of: index))
            : between(from, to: to)
        let middle = Self.mid(of: points)
        return MermaidRoute(
            figures: marks(along: points, of: edge), mid: middle.at, run: middle.run,
        )
    }

    /// A forward edge: out of the leaving box's own face, across the gap in the middle, and into
    /// the entering box's. Three segments where the two boxes are not in line and one where they
    /// are, which is what makes a straight chain read as a straight line.
    private func between(_ from: CGRect, to: CGRect) -> [CGPoint] {
        let axis = placement.axis
        let start = axis.exit(of: from)
        let end = axis.entry(of: to)
        guard axis.across(of: start) != axis.across(of: end) else { return [start, end] }
        let turn = (axis.along(of: start) + axis.along(of: end)) / 2
        return [
            start,
            axis.point(along: turn, across: axis.across(of: start)),
            axis.point(along: turn, across: axis.across(of: end)),
            end,
        ]
    }

    /// An edge that runs BACK against the ranks — a cycle's own closing edge, or a self-loop. It
    /// leaves and re-enters by the flank and runs its length in a lane outside the diagram, so it
    /// never shares a line with the forward edges it is answering.
    private func around(_ from: CGRect, to: CGRect, lane: CGFloat) -> [CGPoint] {
        let axis = placement.axis
        let start = axis.flank(of: from)
        let end = axis.flank(of: to)
        return [
            start,
            axis.point(along: axis.along(of: start), across: lane),
            axis.point(along: axis.along(of: end), across: lane),
            end,
        ]
    }

    /// The lane one back edge runs in: one step further out than the back edge before it, counted
    /// off the leading edge of the whole diagram rather than off either box.
    ///
    /// A lane per edge and not one for all of them. Two edges closing the same loop share a lane
    /// otherwise, and two lines drawn on top of each other read as one edge that is not there.
    private func lane(of index: Int) -> CGFloat {
        let ordinal = reversed.count { $0 < index } + 1
        return -MermaidMeasure.backLane * CGFloat(ordinal)
    }

    /// The connector and, where the link has one, its head — the line stopped short of its own tip
    /// so the head reads as a point rather than a blot.
    private func marks(along points: [CGPoint], of edge: MermaidGraph.Edge) -> [MermaidFigure] {
        let line = edge.line
        guard edge.hasHead, points.count > 1 else {
            return [MermaidFigure(form: .path(points), role: .edge, line: line)]
        }
        let tip = points[points.count - 1]
        let stem = Self.back(from: tip, towards: points[points.count - 2])
        return [
            MermaidFigure(form: .path(points.dropLast() + [stem]), role: .edge, line: line),
            MermaidFigure(form: .arrowhead(tip: tip, from: stem), role: .edge, line: line),
        ]
    }

    /// The point a head stands back at, one arrow's length up the line it came in on.
    private static func back(from tip: CGPoint, towards previous: CGPoint) -> CGPoint {
        let run = CGPoint(x: previous.x - tip.x, y: previous.y - tip.y)
        let length = max(sqrt(run.x * run.x + run.y * run.y), MermaidMeasure.stroke)
        let step = min(MermaidMeasure.arrowLength, length)
        return CGPoint(x: tip.x + run.x / length * step, y: tip.y + run.y / length * step)
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
