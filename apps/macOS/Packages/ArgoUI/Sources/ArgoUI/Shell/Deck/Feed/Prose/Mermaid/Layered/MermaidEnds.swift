import Foundation

/// A route's two ends: the stroke trimmed back off each box's face by whatever its cap asked for,
/// and the face itself with the way the line runs into it.
///
/// The trim is the point. A mark drawn over a line that runs on underneath it reads as a blot, so
/// the stroke stops where the mark begins — whether that mark is the pass's own arrowhead or one
/// the reader draws in the room it asked for (#865).
struct MermaidEnds: Equatable, Sendable {
    let stroke: [CGPoint]
    let tail: MermaidRoute.End
    let head: MermaidRoute.End
}

extension MermaidEnds {
    /// The ends of this run of points, or `nil` for a route too short to have a direction at all.
    static func of(_ points: [CGPoint], edge: MermaidGraph.Edge) -> Self? {
        guard points.count > 1, let first = points.first, let last = points.last else { return nil }
        let tail = MermaidRoute.End(at: first, run: run(from: points[1], to: first))
        let head = MermaidRoute.End(at: last, run: run(from: points[points.count - 2], to: last))
        var stroke = points
        stroke[0] = tail.back(reach(of: edge.tail, over: first, points[1]))
        stroke[stroke.count - 1] = head
            .back(reach(of: edge.head, over: points[points.count - 2], last))
        return MermaidEnds(stroke: stroke, tail: tail, head: head)
    }

    /// How far a cap really takes back: what it asked for, never more than the segment it stands on
    /// — a cap longer than its own last segment would fold the line back on itself.
    private static func reach(
        of cap: MermaidGraph.Cap,
        over from: CGPoint,
        _ to: CGPoint,
    )
        -> CGFloat {
        min(cap.room, hypot(to.x - from.x, to.y - from.y))
    }

    /// A unit vector from one point to another, pointing along `y` where the two are the same point
    /// — a direction no mark can be drawn without, and a zero-length segment has none of its own.
    private static func run(from: CGPoint, to: CGPoint) -> CGPoint {
        let span = CGPoint(x: to.x - from.x, y: to.y - from.y)
        let length = hypot(span.x, span.y)
        guard length > 0 else { return CGPoint(x: 0, y: 1) }
        return CGPoint(x: span.x / length, y: span.y / length)
    }
}
