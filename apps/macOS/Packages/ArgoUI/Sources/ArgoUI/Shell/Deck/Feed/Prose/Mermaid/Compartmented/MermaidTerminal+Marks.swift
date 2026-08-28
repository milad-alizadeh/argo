import Foundation

// Each terminal as the marks it really draws, standing on the box's own face and running back up
// the line towards the rest of the relationship.
//
// Every mark is stroked SOLID whatever the connector is. A dashed realisation draws a dashed line
// and a whole triangle: dashing the mark itself would take the one figure that says which
// relationship this is and break it into strokes nobody can tell from the line's own dashes.

extension MermaidTerminal {
    func marks(at end: MermaidRoute.End) -> [MermaidFigure] {
        switch self {
        case .none:
            []
        case .arrow:
            [MermaidFigure(form: .arrowhead(tip: end.at, from: end.back(room)), role: .edge)]
        case .triangle:
            [Self.hollow(Self.triangle(at: end))]
        case let .diamond(isSolid):
            [Self.diamond(at: end, isSolid: isSolid)]
        case let .crowsFoot(isMany, isOptional):
            Self.crowsFoot(at: end, isMany: isMany, isOptional: isOptional)
        }
    }

    /// A triangle standing on the face, as wide at its back as the measure sheet says.
    private static func triangle(at end: MermaidRoute.End) -> [CGPoint] {
        [end.at] + side(
            of: end, at: end.back(MermaidMeasure.markLength), width: MermaidMeasure.markWidth,
        )
    }

    /// A diamond ALONG the line — its long axis on the line, its points to either side.
    private static func diamond(at end: MermaidRoute.End, isSolid: Bool) -> MermaidFigure {
        let sides = Self.side(
            of: end,
            at: end.back(MermaidMeasure.diamondLength / 2),
            width: MermaidMeasure.diamondWidth,
        )
        let points = [end.at, sides[0], end.back(MermaidMeasure.diamondLength), sides[1]]
        guard isSolid else { return hollow(points) }
        return MermaidFigure(form: .polygon(points), role: .edge)
    }

    /// The maximum at the face and the minimum a step behind it — the pair a crow's foot is.
    private static func crowsFoot(
        at end: MermaidRoute.End,
        isMany: Bool,
        isOptional: Bool,
    )
        -> [MermaidFigure] {
        let reach = isMany ? MermaidMeasure.footLength : MermaidMeasure.footStep / 2
        let least = end.back(reach + MermaidMeasure.footStep)
        let most = isMany ? fork(at: end) : [bar(at: end.back(reach), of: end)]
        return most + (isOptional ? ring(at: least) : [bar(at: least, of: end)])
    }

    /// The fork that says MANY. Its prongs reach the face itself, which is why a crow's foot leaves
    /// the stroke where it was rather than taking room off it.
    private static func fork(at end: MermaidRoute.End) -> [MermaidFigure] {
        let apex = end.back(MermaidMeasure.footLength)
        let sides = Self.side(of: end, at: end.at, width: MermaidMeasure.footWidth)
        return [
            MermaidFigure(form: .path([sides[0], apex, sides[1]]), role: .edge),
            MermaidFigure(form: .path([apex, end.at]), role: .edge),
        ]
    }

    /// The ring that says a minimum of NONE. TWO figures over one circle: a disc in the box's own
    /// ground so the line it sits on does not run through the middle of it, and the ring itself
    /// over that in the CONNECTOR's ink.
    ///
    /// Not one figure at `.node`. `MermaidInk` strokes a node in `edge.subtle`, which stands at a
    /// fraction of the ink the fork and the bars beside it are drawn in — and `}o` differs from
    /// `}|` in this mark alone, so a ring that cannot be seen says "one or more" where the source
    /// said "zero or more". `.edge` has no ground of its own by design, which is why it takes both.
    private static func ring(at point: CGPoint) -> [MermaidFigure] {
        let side = MermaidMeasure.footDot
        let box = CGRect(
            x: point.x - side / 2, y: point.y - side / 2, width: side, height: side,
        )
        return [
            MermaidFigure(form: .shape(.ellipse, box)),
            MermaidFigure(form: .shape(.ellipse, box), role: .edge),
        ]
    }

    /// A bar drawn square across the line at a point on it.
    private static func bar(at point: CGPoint, of end: MermaidRoute.End) -> MermaidFigure {
        MermaidFigure(
            form: .path(side(of: end, at: point, width: MermaidMeasure.footWidth)),
            role: .edge,
        )
    }

    /// The two points that stand `width` apart square across the line, centred on a point of it.
    private static func side(
        of end: MermaidRoute.End,
        at point: CGPoint,
        width: CGFloat,
    )
        -> [CGPoint] {
        let across = end.across
        let half = width / 2
        return [
            CGPoint(x: point.x + across.x * half, y: point.y + across.y * half),
            CGPoint(x: point.x - across.x * half, y: point.y - across.y * half),
        ]
    }

    /// A closed run of points, stroked rather than filled — the same shape said hollow.
    private static func hollow(_ points: [CGPoint]) -> MermaidFigure {
        MermaidFigure(form: .path(points + points.prefix(1)), role: .edge)
    }
}
