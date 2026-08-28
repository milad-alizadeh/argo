import Foundation

/// One drawn mark of a laid-out diagram, in the plan's own coordinates.
///
/// It carries a role and never a colour — see `MermaidRole`.
struct MermaidFigure: Equatable, Sendable {
    let form: Form
    var role: MermaidRole = .node

    /// The shapes a plan is allowed to be made of. Every diagram type reduces to these, which is
    /// the whole reason one view can draw all of them.
    enum Form: Equatable, Sendable {
        case rect(CGRect)
        case roundedRect(CGRect)
        case diamond(CGRect)
        case ellipse(CGRect)
        /// A polyline, in order. Two points is a straight connector.
        case path([CGPoint])
        /// A connector's head: a triangle pointing at `tip`, standing back along the line from
        /// `from`.
        case arrowhead(tip: CGPoint, from: CGPoint)
    }
}

extension MermaidFigure.Form {
    /// The box this form occupies. What the overview lane maps, so a diagram contributes its own
    /// silhouette to the lane rather than a featureless slab.
    var bounds: CGRect {
        switch self {
        case let .rect(rect), let .roundedRect(rect), let .diamond(rect), let .ellipse(rect):
            rect
        case let .path(points):
            Self.around(points)
        case let .arrowhead(tip, from):
            Self.around([tip, from])
        }
    }

    private static func around(_ points: [CGPoint]) -> CGRect {
        guard let first = points.first else { return .zero }
        return points.dropFirst().reduce(CGRect(origin: first, size: .zero)) { box, point in
            box.union(CGRect(origin: point, size: .zero))
        }
    }
}
