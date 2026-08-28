import Foundation

/// One drawn mark of a laid-out diagram, in the plan's own coordinates.
///
/// It carries a role and never a colour — see `MermaidRole`.
struct MermaidFigure: Equatable, Sendable {
    let form: Form
    var role: MermaidRole = .node
    /// How the outline is drawn. A dotted or a thick connector is the same ROLE as a plain one —
    /// the same thing said more quietly or more loudly — so how it is stroked is its own property
    /// rather than a second role.
    var line: Line = .solid

    /// The marks a plan is allowed to be made of. Every diagram type reduces to these, which is the
    /// whole reason one view can draw all of them.
    ///
    /// A closed outline is ONE case carrying which outline it is, rather than a case per shape:
    /// where it stands, how it moves and how big it is are the same answer for all of them, and
    /// only the path differs.
    enum Form: Equatable, Sendable {
        case shape(Outline, CGRect)
        /// A polyline, in order. Two points is a straight connector.
        case path([CGPoint])
        /// A connector's head: a triangle pointing at `tip`, standing back along the line from
        /// `from`.
        case arrowhead(tip: CGPoint, from: CGPoint)
    }

    /// The closed outlines there are — mermaid's node shapes, and the enclosure a `subgraph` draws.
    enum Outline: Equatable, Sendable, CaseIterable {
        case rect
        case rounded
        case diamond
        /// A circle when the box is square, which is the only box a layout gives it.
        case ellipse
        /// Both ends fully rounded: mermaid's stadium.
        case capsule
        /// A rect with a bar down each end.
        case subroutine
        /// Six sides, the two ends cut back to a point.
        case hexagon
        /// Five sides, one end cut to a point: mermaid's asymmetric flag.
        case flag
        /// A drum standing on its end — a rect with an elliptical lid.
        case cylinder
        /// The frame a `subgraph` is drawn as, at its own softer corner.
        case enclosure
    }

    enum Line: Equatable, Sendable {
        case solid, dotted, thick
    }
}

extension MermaidFigure.Form {
    /// The box this form occupies. What the overview lane maps, so a diagram contributes its own
    /// silhouette to the lane rather than a featureless slab.
    var bounds: CGRect {
        switch self {
        case let .shape(_, rect): rect
        case let .path(points): Self.around(points)
        case let .arrowhead(tip, from): Self.around([tip, from])
        }
    }

    /// The same form, moved. What lets a layout place its figures wherever they fall and slide the
    /// whole plan into positive coordinates afterwards.
    func moved(by offset: CGPoint) -> Self {
        switch self {
        case let .shape(outline, rect):
            .shape(outline, rect.offsetBy(dx: offset.x, dy: offset.y))
        case let .path(points):
            .path(points.map { $0.moved(by: offset) })
        case let .arrowhead(tip, from):
            .arrowhead(tip: tip.moved(by: offset), from: from.moved(by: offset))
        }
    }

    private static func around(_ points: [CGPoint]) -> CGRect {
        guard let first = points.first else { return .zero }
        return points.dropFirst().reduce(CGRect(origin: first, size: .zero)) { box, point in
            box.union(CGRect(origin: point, size: .zero))
        }
    }
}

extension CGPoint {
    /// The same point, `offset` further along both axes.
    func moved(by offset: CGPoint) -> CGPoint {
        CGPoint(x: x + offset.x, y: y + offset.y)
    }
}
