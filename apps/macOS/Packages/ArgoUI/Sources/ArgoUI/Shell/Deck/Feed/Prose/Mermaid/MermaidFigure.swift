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
    /// How much of a SERIES ground is laid down. Orthogonal to the role exactly as `line` is: a
    /// spent bar and a live one are one thing said at two strengths, not two roles — which is what
    /// makes a Gantt's `done`, plain and `active` read as a scale (#905).
    ///
    /// It reaches the series ground and nothing else. `MermaidInk` honours it there and ignores it
    /// on every other ground and on every stroke, because "the same thing, spent" is a question
    /// only a categorical fill has an answer to — a half-laid node ground reads as a hole in the
    /// surface, and a dimmed connector as a mistake.
    var weight: Weight = .full

    /// The marks a plan is allowed to be made of. Every diagram type reduces to these, which is the
    /// whole reason one view can draw all of them.
    ///
    /// A closed outline is ONE case carrying which outline it is, rather than a case per shape:
    /// where it stands, how it moves and how big it is are the same answer for all of them, and
    /// only the path differs.
    enum Form: Equatable, Sendable {
        case shape(MermaidOutline, CGRect)
        /// A wedge of the circle inscribed in the box — see `MermaidArc`.
        case arc(MermaidArc, CGRect)
        /// A polyline, in order. Two points is a straight connector.
        case path([CGPoint])
        /// A closed run of points, FILLED in its own line ink. A mark small enough that a stroked
        /// outline would read as a smudge and whose silhouette is not a `MermaidOutline` in any
        /// box — a composition's diamond, which stands ALONG the line rather than square to the
        /// page (#865).
        case polygon([CGPoint])
        /// A connector's head: a triangle pointing at `tip`, standing back along the line from
        /// `from`.
        case arrowhead(tip: CGPoint, from: CGPoint)
    }

    enum Line: Equatable, Sendable {
        case solid, dotted, thick
    }

    /// The three strengths a series ground is laid down at, quietest first. Three and not a
    /// number, so a layout states which rung it means rather than an opacity — the ink layer owns
    /// the values, and the contract owns the exemption they take.
    enum Weight: Equatable, Sendable {
        case spent, ordinary, full
    }
}

extension MermaidFigure.Form {
    /// The box this form occupies. What the overview lane maps, so a diagram contributes its own
    /// silhouette to the lane rather than a featureless slab.
    var bounds: CGRect {
        switch self {
        case let .shape(_, rect): rect
        // Its own box and not the circle's: a wedge covers a fraction of what it is inscribed in,
        // and the plan is SIZED from this.
        case let .arc(arc, rect): arc.bounds(in: rect)
        case let .path(points), let .polygon(points): .around(points)
        case let .arrowhead(tip, from): .around([tip, from])
        }
    }

    /// The same form, moved. What lets a layout place its figures wherever they fall and slide the
    /// whole plan into positive coordinates afterwards.
    func moved(by offset: CGPoint) -> Self {
        switch self {
        case let .shape(outline, rect):
            .shape(outline, rect.offsetBy(dx: offset.x, dy: offset.y))
        case let .arc(arc, rect):
            .arc(arc, rect.offsetBy(dx: offset.x, dy: offset.y))
        case let .path(points):
            .path(points.map { $0.moved(by: offset) })
        case let .polygon(points):
            .polygon(points.map { $0.moved(by: offset) })
        case let .arrowhead(tip, from):
            .arrowhead(tip: tip.moved(by: offset), from: from.moved(by: offset))
        }
    }
}

extension CGRect {
    /// The smallest box holding every one of these points. Shared, because a form's own bounds and
    /// a wedge's are the same reduction over different points.
    static func around(_ points: [CGPoint]) -> CGRect {
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
